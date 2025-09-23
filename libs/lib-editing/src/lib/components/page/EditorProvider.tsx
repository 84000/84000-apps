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
import { usePathname, useRouter } from 'next/navigation';
import type { EditorMenuItemType } from './types';
import type { TranslationEditorContent } from '../editor/TranslationEditor';
import { EditorSidebar } from './EditorSidebar';
import {
  GlossaryTermInstance,
  createBrowserClient,
  getGlossaryInstance,
  getPassage,
} from '@data-access';
import { blockFromPassage } from '../../block';
import { EditorHeader } from './EditorHeader';
import { PassageExportDTO, passageFromNode } from '../../passage';

interface EditorContextState {
  doc?: Doc;
  editor?: Editor;
  uuid: string;
  builder: EditorMenuItemType;
  dirtyUuids: string[];
  getFragment: () => XmlFragment;
  fetchEndNote: (uuid: string) => Promise<TranslationEditorContent | undefined>;
  fetchGlossaryTerm: (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;
  setBuilder: (active: EditorMenuItemType) => void;
  setDoc: (doc: Doc) => void;
  setEditor: (editor?: Editor) => void;
  save: () => Promise<void>;
  startObserving: () => void;
  stopObserving: () => void;
}

export const EditorContext = createContext<EditorContextState>({
  uuid: '',
  builder: 'body',
  dirtyUuids: [],
  getFragment: () => {
    throw Error('Not implemented');
  },
  fetchEndNote: async (_uuid: string) => {
    throw Error('Not implemented');
  },
  fetchGlossaryTerm: async (_uuid: string) => {
    throw Error('Not implemented');
  },
  setBuilder: () => {
    throw Error('Not implemented');
  },
  setDoc: () => {
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
  uuid: string;
  doc?: Doc;
  children: React.ReactNode;
}

export const EditorContextProvider = ({
  uuid,
  doc: initialDoc,
  children,
}: EditorContextProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const client = createBrowserClient();
  const passageCache = useRef<{ [uuid: string]: TranslationEditorContent }>({});
  const glossaryCache = useRef<{ [uuid: string]: GlossaryTermInstance }>({});

  const pathEnd = pathname.split('/').pop();
  const isUuidPath = pathEnd === uuid;
  const initialBuilder = isUuidPath ? 'body' : (pathEnd as EditorMenuItemType);
  const [builder, setBuilder] = useState<EditorMenuItemType>(initialBuilder);
  const [doc, setDoc] = useState<Doc>(initialDoc || new Doc());
  const [editor, setEditor] = useState<Editor>();
  const [dirtyUuids, setDirtyUuids] = useState<string[]>([]);

  const getFragment = useCallback((): XmlFragment => {
    return doc?.getXmlFragment(builder);
  }, [builder, doc]);

  const fetchEndNote = useCallback(
    async (uuid: string) => {
      if (!passageCache.current) {
        passageCache.current = {};
      }

      if (passageCache.current[uuid]) {
        return passageCache.current[uuid];
      }

      const passage = await getPassage({ client, uuid });
      if (!passage) {
        return undefined;
      }

      const block = blockFromPassage(passage);
      passageCache.current[uuid] = block;

      return block;
    },
    [client, passageCache],
  );

  const fetchGlossaryTerm = useCallback(
    async (uuid: string) => {
      if (!glossaryCache.current) {
        glossaryCache.current = {};
      }

      if (glossaryCache.current[uuid]) {
        return glossaryCache.current[uuid];
      }

      const term = await getGlossaryInstance({ client, uuid });
      if (!term) {
        return undefined;
      }

      glossaryCache.current[uuid] = term;
      return term;
    },
    [client],
  );

  const save = useCallback(async () => {
    if (!editor) {
      console.warn('No editor instance found, cannot save.');
      return;
    }

    editor.commands.blur();
    const passages: PassageExportDTO[] = [];
    dirtyUuids.forEach((uuid) => {
      const node = editor.$node('passage', { uuid });
      if (!node) {
        console.warn(`No passage node found for uuid: ${uuid}`);
        return;
      }

      passages.push(passageFromNode(node.node));
    });
    console.log(passages);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log('Document state saved.');
    editor.commands.focus();

    setDirtyUuids([]);
  }, [editor, dirtyUuids]);

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

  const startObserving = useCallback(() => {
    const fragment = getFragment();
    if (fragment) {
      fragment.observeDeep(observerFunction);
    }
  }, [getFragment, observerFunction]);

  const stopObserving = useCallback(() => {
    const fragment = getFragment();
    if (fragment && observerFunction) {
      fragment.unobserveDeep(observerFunction);
    }
  }, [getFragment, observerFunction]);

  const toNewBuilder = useCallback(
    (builder: EditorMenuItemType) => {
      stopObserving();
      setEditor(undefined);
      setDoc(new Doc());
      setDirtyUuids([]);
      setBuilder(builder);
    },
    [stopObserving],
  );

  useEffect(() => {
    const nextPath = `/publications/editor/${uuid}/${builder}`;

    if (pathname === nextPath) {
      return;
    }

    router.push(nextPath);
  }, [uuid, builder, pathname, router]);

  useEffect(() => {
    if (!dirtyUuids.length) {
      return;
    }

    console.log('Dirty uuids:', dirtyUuids);
  }, [dirtyUuids, save]);

  return (
    <EditorContext.Provider
      value={{
        uuid,
        builder,
        doc,
        editor,
        dirtyUuids,
        getFragment,
        fetchEndNote,
        fetchGlossaryTerm,
        setDoc,
        setEditor,
        setBuilder,
        save,
        startObserving,
        stopObserving,
      }}
    >
      <EditorSidebar active={builder || 'body'} onClick={toNewBuilder}>
        <EditorHeader />
        {children}
        <div className="h-[var(--header-height)]" />
      </EditorSidebar>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
