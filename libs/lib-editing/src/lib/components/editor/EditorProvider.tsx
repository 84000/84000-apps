'use client';

import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Editor } from '@tiptap/react';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Doc, Transaction, XmlElement, XmlFragment, YEvent } from 'yjs';
import type { Passage, Work } from '@eightyfourthousand/data-access';
import {
  createGraphQLClient,
  hasPermission,
  type ReplacedPassage,
  savePassages,
} from '@eightyfourthousand/client-graphql';
import { Toaster, toast } from '@eightyfourthousand/design-system';
import { passagesFromNodes, ensureUuids } from '../../passage';
import { NavigationProvider } from '../shared';
import { useDirtyStore, type DirtyStore } from './hooks/useDirtyStore';
import { computeSavePayload, type PassageUuidRecord } from './save-filter';
import {
  beginSave,
  filterReplacements,
  restoreFailedSave,
} from './save-bookkeeping';
import {
  captureFragmentBaseline,
  collectPassageUuids,
  diffPassageUuids,
  findObservedFragment,
  shouldRescanFragment,
  type FragmentBaseline,
} from './observer-utils';

interface EditorContextState {
  doc?: Doc;
  work: Work;
  dirtyStore: DirtyStore;
  canEdit(): Promise<boolean>;
  applyReplacedPassages: (passages: ReplacedPassage[]) => Promise<void>;
  getFragment: (builder: string) => XmlFragment;
  setDoc: (doc: Doc) => void;
  getEditor: (key: string) => Editor | undefined;
  setEditor: (key: string, editor?: Editor) => void;
  refreshEditorBaseline: (key: string) => void;
  save: () => Promise<void>;
  startObserving: (builder: string) => void;
  stopObserving: (builder: string) => void;
  setNavigating: (
    navigating: boolean,
    resetLastObservedUuids?: boolean,
    fragment?: XmlFragment,
  ) => void;
  isNavigating: () => boolean;
}

export const EditorContext = createContext<EditorContextState>({
  work: {
    uuid: '',
    title: '',
    section: '',
    pages: 0,
    publicationDate: new Date(),
    publicationVersion: '0.0.0',
    restriction: false,
    toh: [],
  },
  dirtyStore: {
    isDirty: false,
    listeners: new Set(),
    subscribe: () => () => {
      // No-op cleanup - safe for useSyncExternalStore in reader mode
    },
    setDirty: () => {
      // No-op when outside provider (reader mode)
    },
    getSnapshot: () => false,
  },
  canEdit: async () => false,
  applyReplacedPassages: async () => {
    // No-op when outside provider
  },
  getFragment: () => {
    throw Error('Not implemented');
  },
  setDoc: () => {
    throw Error('Not implemented');
  },
  getEditor: () => undefined,
  setEditor: () => {
    throw Error('Not implemented');
  },
  refreshEditorBaseline: () => {
    // No-op when outside provider
  },
  save: async () => {
    toast('Unable to save.', {
      icon: <TriangleAlertIcon className="size-4 text-warning" />,
    });
  },
  startObserving: () => {
    throw Error('Not implemented');
  },
  stopObserving: () => {
    throw Error('Not implemented');
  },
  setNavigating: () => {
    // No-op when outside provider
  },
  isNavigating: () => false,
});

interface EditorContextProps {
  work: Work;
  doc?: Doc;
  children: React.ReactNode;
}

export const EditorContextProvider = ({
  work,
  doc: initialDoc,
  children,
}: EditorContextProps) => {
  const client = createGraphQLClient();

  const [doc, setDoc] = React.useState<Doc>(initialDoc || new Doc());
  // Use ref for immediate tracking to avoid state updates on every keystroke
  const dirtyUuidsRef = useRef<Set<string>>(new Set());
  const isSavingRef = useRef(false);
  const isNavigatingRef = useRef(false);
  const isNormalizingForSaveRef = useRef(false);
  const clearedFragmentRef = useRef<XmlFragment | null>(null);
  const fragmentBaselinesRef = useRef<Map<XmlFragment, FragmentBaseline>>(
    new Map(),
  );
  const savedBaselineUuidsByEditorRef = useRef<PassageUuidRecord>({});
  const observedFragmentsByBuilderRef = useRef<Record<string, XmlFragment>>({});

  // Store for dirty state with subscription support
  const dirtyStore = useDirtyStore();

  const editorCache = useRef<{ [key: string]: Editor }>({});

  const getEditor = useCallback((key: string) => {
    return editorCache.current[key];
  }, []);

  const setEditor = useCallback((key: string, editor?: Editor) => {
    if (!editor && editorCache.current[key]) {
      delete editorCache.current[key];
      delete savedBaselineUuidsByEditorRef.current[key];
    } else if (editor) {
      editorCache.current[key] = editor;
    }
  }, []);

  const getFragment = useCallback(
    (builder: string): XmlFragment => {
      return doc?.getXmlFragment(builder);
    },
    [doc],
  );

  const getEditorUuids = useCallback((editor: Editor) => {
    const uuids = new Set<string>();
    editor.state.doc.descendants((node) => {
      if (node.type.name !== 'passage' || !node.attrs.uuid) {
        return true;
      }

      uuids.add(node.attrs.uuid);
      return false;
    });
    return uuids;
  }, []);

  const refreshEditorBaseline = useCallback(
    (key: string) => {
      const editor = editorCache.current[key];
      if (!editor || editor.isDestroyed) {
        return;
      }

      savedBaselineUuidsByEditorRef.current[key] = getEditorUuids(editor);

      const fragment = getFragment(key);
      if (fragment) {
        fragmentBaselinesRef.current.set(
          fragment,
          captureFragmentBaseline(fragment),
        );
      }
    },
    [getEditorUuids, getFragment],
  );

  const observerFunction = useCallback(
    (evts: YEvent<XmlFragment | XmlElement>[], txn: Transaction) => {
      if (!txn.local) {
        return;
      }
      if (isNavigatingRef.current || isNormalizingForSaveRef.current) {
        return;
      }

      // Detect passage additions/deletions by diffing the baseline UUIDs
      // against the current fragment state — but only when the cheap gate
      // says the passage set could have changed. Plain typing previously
      // paid this O(passages) scan on every keystroke.
      // We intentionally avoid deriving additions/deletions from Yjs
      // `changes.deleted` directly because operations like splitPassage
      // (replaceWith + insert) cause the binding to delete and re-create
      // XmlElements internally, producing false positives; the deltas are
      // only used as a rescan trigger, where a false positive is harmless.
      // Additions must come from the scan because splitPassage creates
      // XmlElements with attributes set pre-integration, so txn.changed
      // never includes them.
      if (evts.length > 0) {
        const fragment = findObservedFragment(evts);
        if (fragment) {
          const baseline = fragmentBaselinesRef.current.get(fragment);
          if (shouldRescanFragment(evts, fragment, baseline)) {
            const liveUuids = collectPassageUuids(fragment);

            if (baseline && baseline.uuids.size > 0) {
              const { added, hasDeleted } = diffPassageUuids(
                baseline.uuids,
                liveUuids,
              );
              added.forEach((uuid) => dirtyUuidsRef.current.add(uuid));
              if (hasDeleted && !dirtyStore.isDirty) {
                dirtyStore.setDirty(true);
              }
            }

            fragmentBaselinesRef.current.set(fragment, {
              uuids: liveUuids,
              length: fragment.length,
            });
          }
        }
      }

      txn.changed.forEach((_change, key) => {
        // Start from key itself (not key.parent) so that structural changes
        // directly on a passage XmlElement (e.g. children moved during merge)
        // are detected. For leaf types like XmlText, nodeName is undefined so
        // the walk-up proceeds to the parent as before.
        let node = key as unknown as XmlElement;
        while (node?.nodeName !== 'passage' && node?.parent) {
          node = node.parent as XmlElement;
        }

        const uuid = node?.getAttribute?.('uuid');
        if (uuid) {
          // Add directly to ref - no state update on every keystroke
          dirtyUuidsRef.current.add(uuid);
          // Only update dirty state if it's not already dirty
          // This prevents re-renders on every keystroke after the first one
          if (!dirtyStore.isDirty) {
            dirtyStore.setDirty(true);
          }
        }
      });
    },
    [dirtyStore],
  );

  const startObserving = useCallback(
    (builder: string) => {
      const fragment = getFragment(builder);
      if (fragment) {
        const observedFragment = observedFragmentsByBuilderRef.current[builder];
        if (observedFragment === fragment) {
          refreshEditorBaseline(builder);
          return;
        }

        if (observedFragment) {
          observedFragment.unobserveDeep(observerFunction);
          fragmentBaselinesRef.current.delete(observedFragment);
        }

        // Pre-populate the fragment baseline so the diff-based deletion
        // detection has a baseline from the very first observer event.
        // Without this, a merge that happens before any other edit would not be
        // detected because the ref would be empty and the diff would be skipped.
        fragmentBaselinesRef.current.set(
          fragment,
          captureFragmentBaseline(fragment),
        );

        fragment.observeDeep(observerFunction);
        observedFragmentsByBuilderRef.current[builder] = fragment;
        refreshEditorBaseline(builder);
      }
    },
    [getFragment, observerFunction, refreshEditorBaseline],
  );

  const stopObserving = useCallback(
    (builder: string) => {
      const observedFragment = observedFragmentsByBuilderRef.current[builder];
      if (observedFragment) {
        observedFragment.unobserveDeep(observerFunction);
        fragmentBaselinesRef.current.delete(observedFragment);
        delete observedFragmentsByBuilderRef.current[builder];
      }
      delete savedBaselineUuidsByEditorRef.current[builder];
    },
    [observerFunction],
  );

  const setNavigating = useCallback(
    (
      navigating: boolean,
      resetLastObservedUuids = false,
      fragment?: XmlFragment,
    ) => {
      isNavigatingRef.current = navigating;
      if (navigating && resetLastObservedUuids) {
        // Clear last observed UUIDs so the first observer call after navigation
        // repopulates without diffing against the stale pre-navigation set.
        // Only done for full navigation (clearContent + setContent), not for
        // load-more which only adds passages and needs to keep its baseline.
        // When a specific fragment is provided, only clear that fragment's
        // entry so other editors (e.g. endnotes) retain their baseline and
        // can still detect deletions.
        if (fragment) {
          fragmentBaselinesRef.current.delete(fragment);
          clearedFragmentRef.current = fragment;
        } else {
          fragmentBaselinesRef.current.clear();
        }
      }

      // When navigation ends, repopulate the baseline for any fragment that
      // was cleared so deletion detection works immediately — without waiting
      // for an intervening Y.js event to re-establish the baseline.
      if (!navigating && clearedFragmentRef.current) {
        const f = clearedFragmentRef.current;
        clearedFragmentRef.current = null;
        fragmentBaselinesRef.current.set(f, captureFragmentBaseline(f));
      }
    },
    [],
  );

  const isNavigating = useCallback(() => isNavigatingRef.current, []);

  const canEdit = useCallback(async () => {
    return await hasPermission({ client, permission: 'EDITOR_EDIT' });
  }, [client]);

  const applyReplacedPassages = useCallback(
    async (passages: ReplacedPassage[]) => {
      if (passages.length === 0) {
        return;
      }

      setNavigating(true);

      try {
        const passagesByUuid = new Map(
          passages
            .filter(
              (
                passage,
              ): passage is ReplacedPassage & {
                json: NonNullable<ReplacedPassage['json']>;
              } => Boolean(passage.json),
            )
            .map((passage) => [passage.uuid, passage]),
        );

        Object.values(editorCache.current).forEach((editor) => {
          if (editor.isDestroyed || passagesByUuid.size === 0) {
            return;
          }

          const replacements: Array<{
            from: number;
            nodeSize: number;
            replacement: NonNullable<ReplacedPassage['json']>;
          }> = [];

          editor.state.doc.descendants((node, pos) => {
            if (node.type.name !== 'passage' || !node.attrs.uuid) {
              return true;
            }

            const replacement = passagesByUuid.get(node.attrs.uuid);
            if (replacement?.json) {
              replacements.push({
                from: pos,
                nodeSize: node.nodeSize,
                replacement: replacement.json,
              });
            }

            return true;
          });

          if (replacements.length === 0) {
            return;
          }

          let tr = editor.state.tr;
          replacements
            .sort((a, b) => b.from - a.from)
            .forEach(({ from, nodeSize, replacement }) => {
              tr = tr.replaceWith(
                from,
                from + nodeSize,
                editor.schema.nodeFromJSON(replacement),
              );
            });

          editor.view.dispatch(tr);
        });
      } finally {
        setNavigating(false);
      }
    },
    [setNavigating],
  );

  const save = useCallback(async () => {
    if (isSavingRef.current) {
      console.warn('Save already in progress; skipping.');
      return;
    }

    const editorEntries = Object.entries(editorCache.current).filter(
      ([, editor]) => !editor.isDestroyed,
    );
    if (!editorEntries.length) {
      console.warn('No editor instance found, cannot save.');
      return;
    }

    const liveUuidsByEditor: PassageUuidRecord = {};
    editorEntries.forEach(([key, editor]) => {
      liveUuidsByEditor[key] = getEditorUuids(editor);
    });
    const savedBaselineUuidsByEditor = Object.fromEntries(
      Object.keys(liveUuidsByEditor)
        .map(
          (key) => [key, savedBaselineUuidsByEditorRef.current[key]] as const,
        )
        .filter((entry): entry is readonly [string, Set<string>] =>
          Boolean(entry[1]),
        ),
    ) as PassageUuidRecord;

    const {
      uuidsToSave,
      uuidsToDelete: deletedUuids,
      hasChanges,
    } = computeSavePayload({
      dirtyUuids: dirtyUuidsRef.current,
      baseline: savedBaselineUuidsByEditor,
      current: liveUuidsByEditor,
    });

    if (!hasChanges) {
      console.log('No changes to save.');
      return;
    }

    // Swap in a fresh dirty set before any await: keystrokes made while the
    // network round-trip is pending land in the new set and survive the
    // post-save bookkeeping instead of being silently cleared.
    const { inFlight: inFlightDirty, next } = beginSave(dirtyUuidsRef.current);
    dirtyUuidsRef.current = next;
    isSavingRef.current = true;

    try {
      // Everything up to the await is synchronous, so the serialized payload
      // is consistent with the uuid sets captured above.
      const passages: Passage[] = [];
      if (uuidsToSave.length) {
        const uuidsToSaveSet = new Set(uuidsToSave);
        isNormalizingForSaveRef.current = true;
        try {
          editorEntries.forEach(([, editor]) => {
            const editorUuids = Array.from(getEditorUuids(editor)).filter(
              (uuid) => uuidsToSaveSet.has(uuid),
            );
            if (editorUuids.length === 0) {
              return;
            }

            ensureUuids(editor, { passageUuids: new Set(editorUuids) });
          });
        } finally {
          isNormalizingForSaveRef.current = false;
        }

        // Blur only the focused editor, once, to flush any pending IME
        // composition into ProseMirror state before the docs are read —
        // blurring editors that never had focus accomplishes nothing, and
        // the old per-editor blur/focus pair stole focus across panels and
        // scrolled the viewport on every save.
        const focusedEntry = editorEntries.find(
          ([, editor]) => editor.isFocused,
        );
        focusedEntry?.[1].commands.blur();

        editorEntries.forEach(([, editor]) => {
          const editorUuids = Array.from(getEditorUuids(editor)).filter(
            (uuid) => uuidsToSaveSet.has(uuid),
          );
          if (editorUuids.length === 0) {
            return;
          }

          passages.push(
            ...passagesFromNodes({
              uuids: editorUuids,
              workUuid: work.uuid,
              editor,
            }),
          );
        });

        // Restore focus where it was, keeping the existing selection and
        // without scrolling, before the network await so focus is never
        // visibly lost.
        focusedEntry?.[1].commands.focus(null, { scrollIntoView: false });
      }
      const result = await savePassages({
        client,
        passages,
        deletedUuids: deletedUuids.length > 0 ? deletedUuids : undefined,
      });

      if (!result?.success) {
        // Nothing was durably confirmed; restore the attempted set so the
        // next save retries it alongside any mid-flight edits.
        dirtyUuidsRef.current = restoreFailedSave(
          inFlightDirty,
          dirtyUuidsRef.current,
        );
        console.error('Save failed:', result?.error ?? 'unknown error');
        toast('Error saving content.', {
          icon: <CircleAlertIcon className="size-4 text-error" />,
        });
        return;
      }

      console.log('Document state saved.');
      toast('Content saved', {
        icon: <CircleCheckIcon className="size-4 text-success" />,
      });

      // Baselines become the uuid sets captured at save start — not the live
      // editor — so passages added or deleted during the flight are still
      // detected by the next save. Skip editors swapped out mid-flight.
      editorEntries.forEach(([key, editor]) => {
        if (editorCache.current[key] === editor && !editor.isDestroyed) {
          savedBaselineUuidsByEditorRef.current[key] = liveUuidsByEditor[key];
        }
      });

      // Server replacements must not overwrite passages the user re-edited
      // during the flight — their newer local content wins and is saved on
      // the next save.
      const replacements = filterReplacements(
        result.passages ?? [],
        dirtyUuidsRef.current,
      );
      if (replacements.length) {
        await applyReplacedPassages(replacements);
      }

      // The dirty flag reflects what is left: mid-flight edits plus any
      // structural changes that have not been saved yet.
      const residualLive: PassageUuidRecord = {};
      Object.entries(editorCache.current)
        .filter(([, editor]) => !editor.isDestroyed)
        .forEach(([key, editor]) => {
          residualLive[key] = getEditorUuids(editor);
        });
      const residual = computeSavePayload({
        dirtyUuids: dirtyUuidsRef.current,
        baseline: savedBaselineUuidsByEditorRef.current,
        current: residualLive,
      });
      dirtyStore.setDirty(residual.hasChanges);
    } finally {
      isSavingRef.current = false;
    }
  }, [
    client,
    work.uuid,
    getEditorUuids,
    applyReplacedPassages,
    dirtyStore,
  ]);

  return (
    <EditorContext.Provider
      value={{
        work,
        doc,
        dirtyStore,
        canEdit,
        applyReplacedPassages,
        getFragment,
        setDoc,
        getEditor,
        setEditor,
        refreshEditorBaseline,
        save,
        startObserving,
        stopObserving,
        setNavigating,
        isNavigating,
      }}
    >
      <NavigationProvider uuid={work.uuid} initialToh={work.toh[0]}>
        {children}
      </NavigationProvider>
      <Toaster />
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
