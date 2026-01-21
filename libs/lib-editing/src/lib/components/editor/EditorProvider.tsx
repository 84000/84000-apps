'use client';

import React, { createContext, useCallback, useContext, useRef } from 'react';
import { Editor } from '@tiptap/react';
import { Doc, Transaction, XmlElement, XmlFragment } from 'yjs';
import {
  Passage,
  Work,
  createBrowserClient,
  hasPermission,
  savePassages,
} from '@data-access';
import { passagesFromNodes } from '../../passage';
import { NavigationProvider } from '../shared';
import { useDirtyStore, type DirtyStore } from './hooks/useDirtyStore';

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
      throw Error('Not implemented');
    },
    setDirty: () => {
      throw Error('Not implemented');
    },
    getSnapshot: () => false,
  },
  canEdit: async () => {
    throw Error('Not implemented');
  },
  getFragment: () => {
    throw Error('Not implemented');
  },
  setDoc: () => {
    throw Error('Not implemented');
  },
  getEditor: () => {
    throw Error('Not implemented');
  },
  setEditor: () => {
    throw Error('Not implemented');
  },
  save: async () => {
    throw Error('Not implemented');
  },
  startObserving: () => {
    throw Error('Not implemented');
  },
  stopObserving: () => {
    throw Error('Not implemented');
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
  const client = createBrowserClient();

  const [doc, setDoc] = React.useState<Doc>(initialDoc || new Doc());
  // Use ref for immediate tracking to avoid state updates on every keystroke
  const dirtyUuidsRef = useRef<Set<string>>(new Set());

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

    // Use the ref directly for the most up-to-date dirty UUIDs
    const uuidsToSave = Array.from(dirtyUuidsRef.current);
    if (!uuidsToSave.length) {
      console.log('No changes to save.');
      return;
    }

    const passages: Passage[] = [];
    editors.forEach((editor) => {
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
    savePassages({ client, passages });
    console.log('Document state saved.');

    // Clear both ref and state
    dirtyUuidsRef.current.clear();
    dirtyStore.setDirty(false);
  }, [editorCache, client, work.uuid]);

  const observerFunction = useCallback((_evts: unknown[], txn: Transaction) => {
    if (!txn.local) {
      return;
    }

    txn.changed.forEach((_change, key) => {
      let node = key.parent as XmlElement;
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
  }, []);

  const startObserving = useCallback(
    (builder: string) => {
      const fragment = getFragment(builder);
      if (fragment) {
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

  const canEdit = useCallback(async () => {
    return await hasPermission({ client, permission: 'editor.edit' });
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
      }}
    >
      <NavigationProvider uuid={work.uuid}>{children}</NavigationProvider>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
