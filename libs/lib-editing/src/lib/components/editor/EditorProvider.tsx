'use client';

import React, { useCallback, useContext, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Doc, Transaction, XmlElement, XmlFragment, YEvent } from 'yjs';
import type { Work } from '@eightyfourthousand/data-access';
import {
  createGraphQLClient,
  hasPermission,
  type ReplacedPassage,
} from '@eightyfourthousand/client-graphql';
import { Toaster } from '@eightyfourthousand/design-system';
import { NavigationProvider } from '../shared';
import { useDirtyStore } from './hooks/useDirtyStore';
import { type PassageUuidRecord } from './save-filter';
import {
  captureFragmentBaseline,
  collectPassageUuids,
  diffPassageUuids,
  findObservedFragment,
  shouldRescanFragment,
  type FragmentBaseline,
} from './observer-utils';
import { EditorContext, type SaveHandler } from './editor-context';
import { useSaveLifecycle } from './useSaveLifecycle';

export { EditorContext } from './editor-context';
export type { SaveHandler, SaveOutcome } from './editor-context';

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

  const canAdminister = useCallback(async () => {
    return await hasPermission({ client, permission: 'EDITOR_ADMIN' });
  }, [client]);

  const saveHandlerRef = useRef<SaveHandler | null>(null);

  const deleteEndnote = useCallback(
    async (uuid: string) =>
      (await saveHandlerRef.current?.deleteEndnote?.(uuid)) ?? false,
    [],
  );

  const removeCommentAnchors = useCallback(
    (comment: string) =>
      saveHandlerRef.current?.removeCommentAnchors?.(comment),
    [],
  );

  const applyReplacedPassages = useCallback(
    async (passages: ReplacedPassage[]) => {
      if (passages.length === 0) {
        return;
      }

      setNavigating(true);

      try {
        saveHandlerRef.current?.applyReplaced?.(passages);

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

  const registerSaveHandler = useCallback((handler: SaveHandler | null) => {
    saveHandlerRef.current = handler;
  }, []);

  const { save } = useSaveLifecycle({
    client,
    work,
    editorCache,
    dirtyUuidsRef,
    isSavingRef,
    isNormalizingForSaveRef,
    savedBaselineUuidsByEditorRef,
    saveHandlerRef,
    dirtyStore,
    getEditorUuids,
    applyReplacedPassages,
    setNavigating,
  });

  return (
    <EditorContext.Provider
      value={{
        work,
        doc,
        dirtyStore,
        canEdit,
        canAdminister,
        applyReplacedPassages,
        deleteEndnote,
        removeCommentAnchors,
        getFragment,
        setDoc,
        getEditor,
        setEditor,
        refreshEditorBaseline,
        save,
        registerSaveHandler,
        startObserving,
        stopObserving,
        setNavigating,
        isNavigating,
      }}
    >
      {/* The studio: editing surfaces are offered here and not in the reader. */}
      <NavigationProvider uuid={work.uuid} initialToh={work.toh[0]} editable>
        {children}
      </NavigationProvider>
      <Toaster />
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
