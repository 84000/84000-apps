'use client';

import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Doc, Transaction, XmlElement, XmlFragment, YEvent } from 'yjs';
import type { Passage, Work } from '@data-access';
import {
  createGraphQLClient,
  hasPermission,
  savePassages,
} from '@client-graphql';
import { passagesFromNodes, ensureUuids } from '../../passage';
import { NavigationProvider } from '../shared';
import { useDirtyStore, type DirtyStore } from './hooks/useDirtyStore';
import { computeSavePayload } from './save-filter';

interface EditorContextState {
  doc?: Doc;
  work: Work;
  dirtyStore: DirtyStore;
  canEdit(): Promise<boolean>;
  getFragment: (builder: string) => XmlFragment;
  setDoc: (doc: Doc) => void;
  getEditor: (key: string) => Editor | undefined;
  setEditor: (key: string, editor?: Editor) => void;
  save: () => Promise<void>;
  startObserving: (builder: string) => void;
  stopObserving: (builder: string) => void;
  setNavigating: (navigating: boolean, resetKnownUuids?: boolean) => void;
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
  save: async () => {
    // No-op when outside provider
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
  const deletedUuidsRef = useRef<Set<string>>(new Set());
  const isNavigatingRef = useRef(false);
  const knownUuidsRef = useRef<Map<XmlFragment, Set<string>>>(new Map());

  // Store for dirty state with subscription support
  const dirtyStore = useDirtyStore();

  const editorCache = useRef<{ [key: string]: Editor }>({});

  const getEditor = useCallback((key: string) => {
    return editorCache.current[key];
  }, []);

  const setEditor = useCallback((key: string, editor?: Editor) => {
    if (!editor && editorCache.current[key]) {
      delete editorCache.current[key];
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

  const save = useCallback(async () => {
    const editors = Object.values(editorCache.current);
    if (!editors.length) {
      console.warn('No editor instance found, cannot save.');
      return;
    }

    // Use the ref directly for the most up-to-date dirty/deleted UUIDs
    const {
      uuidsToSave,
      uuidsToDelete: deletedUuids,
      hasChanges,
    } = computeSavePayload({
      dirtyUuids: dirtyUuidsRef.current,
      deletedUuids: deletedUuidsRef.current,
    });

    if (!hasChanges) {
      console.log('No changes to save.');
      return;
    }

    const passages: Passage[] = [];
    if (uuidsToSave.length) {
      editors.forEach((editor) => {
        // Skip editors whose DOM view has been unmounted (e.g. inactive tabs).
        // Calling blur()/focus() on a destroyed editor throws a TipTap error
        // about view['hasFocus'] not being accessible.
        if (editor.isDestroyed) return;
        // Ensure all nodes have unique, non-null UUIDs before reading them.
        // New paragraph nodes created by splitting (e.g. pressing Enter) have
        // uuid: null until the NodeView mount cycle runs validateAttrs. If we
        // read the document before that cycle completes, annotationExportsFromNode
        // silently drops any annotation whose node.attrs.uuid is falsy, producing
        // missing paragraph annotations. ensureUuids fixes this synchronously.
        ensureUuids(editor);
        editor.commands.blur();
        passages.push(
          ...passagesFromNodes({
            uuids: uuidsToSave,
            workUuid: work.uuid,
            editor,
          }),
        );
        editor.commands.focus();
      });
    }
    const result = await savePassages({
      client,
      passages,
      deletedUuids: deletedUuids.length > 0 ? deletedUuids : undefined,
    });

    if (!result?.success) {
      console.error('Save failed:', result?.error ?? 'unknown error');
      return;
    }

    console.log('Document state saved.');

    // Clear both ref and state
    dirtyUuidsRef.current.clear();
    deletedUuidsRef.current.clear();
    dirtyStore.setDirty(false);
  }, [editorCache, client, work.uuid]);

  const observerFunction = useCallback(
    (evts: YEvent<XmlFragment | XmlElement>[], txn: Transaction) => {
      if (!txn.local) {
        return;
      }

      // Detect passage deletions by diffing known UUIDs against current fragment state.
      // We walk up from any event target to find the observed XmlFragment rather than
      // checking each event's target, because merge operations may only produce events
      // targeting passage-level XmlElements (not the fragment itself).
      // We intentionally avoid using Yjs `changes.deleted` because operations like
      // splitPassage (replaceWith + insert) cause the binding to delete and re-create
      // XmlElements internally, producing false positives.
      if (!isNavigatingRef.current && evts.length > 0) {
        let fragment: XmlFragment | null = null;
        let current: XmlFragment | XmlElement | null = evts[0].target;
        while (current) {
          if (
            current instanceof XmlFragment &&
            !(current instanceof XmlElement)
          ) {
            fragment = current;
            break;
          }
          current = current.parent as XmlFragment | XmlElement | null;
        }

        if (fragment) {
          const currentUuids = new Set<string>();
          for (let i = 0; i < fragment.length; i++) {
            const child = fragment.get(i);
            if (child instanceof XmlElement && child.nodeName === 'passage') {
              const uuid = child.getAttribute('uuid');
              if (uuid) {
                currentUuids.add(uuid);
              }
            }
          }

          const knownForFragment = knownUuidsRef.current.get(fragment);
          if (knownForFragment && knownForFragment.size > 0) {
            // Detect deletions: UUIDs in known set but not in current
            knownForFragment.forEach((uuid) => {
              if (!currentUuids.has(uuid)) {
                deletedUuidsRef.current.add(uuid);
              }
            });

            // Detect new passages: UUIDs in current but not in known.
            // This catches passages created by splitPassage, where the Yjs
            // binding creates XmlElements with attributes set during construction
            // (pre-integration), so txn.changed never includes them.
            currentUuids.forEach((uuid) => {
              if (!knownForFragment.has(uuid)) {
                dirtyUuidsRef.current.add(uuid);
              }
            });
          }

          knownUuidsRef.current.set(fragment, currentUuids);
        }
      }

      if (!isNavigatingRef.current) {
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
      }

      // Mark dirty if there are deletions
      if (deletedUuidsRef.current.size > 0 && !dirtyStore.isDirty) {
        dirtyStore.setDirty(true);
      }
    },
    [],
  );

  const startObserving = useCallback(
    (builder: string) => {
      const fragment = getFragment(builder);
      if (fragment) {
        // Pre-populate knownUuidsRef so the diff-based deletion detection
        // has a baseline from the very first observer event. Without this,
        // a merge that happens before any other edit would not be detected
        // because knownUuidsRef would be empty and the diff would be skipped.
        const uuids = new Set<string>();
        for (let i = 0; i < fragment.length; i++) {
          const child = fragment.get(i);
          if (child instanceof XmlElement && child.nodeName === 'passage') {
            const uuid = child.getAttribute('uuid');
            if (uuid) {
              uuids.add(uuid);
            }
          }
        }
        knownUuidsRef.current.set(fragment, uuids);

        fragment.observeDeep(observerFunction);
      }
    },
    [getFragment, observerFunction],
  );

  const stopObserving = useCallback(
    (builder: string) => {
      const fragment = getFragment(builder);
      if (fragment && observerFunction) {
        fragment.unobserveDeep(observerFunction);
      }
    },
    [getFragment, observerFunction],
  );

  const setNavigating = useCallback(
    (navigating: boolean, resetKnownUuids = false) => {
      isNavigatingRef.current = navigating;
      if (navigating && resetKnownUuids) {
        // Clear known UUIDs so the first observer call after navigation
        // repopulates without diffing against the stale pre-navigation set.
        // Only done for full navigation (clearContent + setContent), not for
        // load-more which only adds passages and needs to keep its baseline.
        knownUuidsRef.current.clear();
      }
    },
    [],
  );

  const canEdit = useCallback(async () => {
    return await hasPermission({ client, permission: 'EDITOR_EDIT' });
  }, [client]);

  return (
    <EditorContext.Provider
      value={{
        work,
        doc,
        dirtyStore,
        canEdit,
        getFragment,
        setDoc,
        getEditor,
        setEditor,
        save,
        startObserving,
        stopObserving,
        setNavigating,
      }}
    >
      <NavigationProvider uuid={work.uuid}>{children}</NavigationProvider>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
