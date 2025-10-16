'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
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

interface EditorContextState {
  doc?: Doc;
  dirtyUuids: string[];
  work: Work;
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
    pages: 0,
    publicationDate: new Date(),
    publicationVersion: '0.0.0',
    restriction: false,
    toh: [],
  },
  dirtyUuids: [],
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

  const [doc, setDoc] = useState<Doc>(initialDoc || new Doc());
  const [dirtyUuids, setDirtyUuids] = useState<string[]>([]);
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
    const editors = Object.values(editorCache);
    if (!editors.length) {
      console.warn('No editor instance found, cannot save.');
      return;
    }

    const passages: Passage[] = [];
    editors.forEach((editor) => {
      editor.commands.blur();
      passages.push(
        ...passagesFromNodes({
          uuids: dirtyUuids,
          workUuid: work.uuid,
          editor,
        }),
      );
      editor.commands.focus();
    });
    savePassages({ client, passages });
    console.log('Document state saved.');

    setDirtyUuids([]);
  }, [editorCache, dirtyUuids, client, work.uuid]);

  const observerFunction = useCallback((_evts: unknown[], txn: Transaction) => {
    if (!txn.local) {
      return;
    }

    const uuids: Set<string> = new Set();
    txn.changed.forEach((_change, key) => {
      let node = key.parent as XmlElement;
      while (node?.nodeName !== 'passage' && node?.parent) {
        node = node.parent as XmlElement;
      }

      const uuid = node?.getAttribute?.('uuid');
      if (uuid) {
        uuids.add(uuid);
      }
    });

    setDirtyUuids((prev) => {
      return [...new Set([...prev, ...uuids])];
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

  useEffect(() => {
    if (!dirtyUuids.length) {
      return;
    }

    // TODO: when we are ready, debounce and save automatically
  }, [dirtyUuids, save]);

  return (
    <EditorContext.Provider
      value={{
        work,
        doc,
        dirtyUuids,
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
      <NavigationProvider>{children}</NavigationProvider>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
