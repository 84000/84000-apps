'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Doc, Transaction, XmlElement, XmlFragment } from 'yjs';
import { EditorBuilderType } from './EditorBuilderType';
import { EditorSidebar } from './EditorSidebar';
import { usePathname, useRouter } from 'next/navigation';

interface EditorContextState {
  doc?: Doc;
  uuid: string;
  builder: EditorBuilderType;
  dirtyUuids: string[];
  getFragment: () => XmlFragment;
  setBuilder: (active: EditorBuilderType) => void;
  setDoc: (doc: Doc) => void;
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
  setBuilder: () => {
    throw Error('Not implemented');
  },
  setDoc: () => {
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

  const pathEnd = pathname.split('/').pop();
  const isUuidPath = pathEnd === uuid;
  const initialBuilder = isUuidPath ? 'body' : (pathEnd as EditorBuilderType);
  const [builder, setBuilder] = useState<EditorBuilderType>(initialBuilder);
  const [doc, setDoc] = useState<Doc>(initialDoc || new Doc());
  const [fragments, setFragments] = useState<{
    [builder: string]: XmlFragment;
  }>({});
  const [dirtyUuids, setDirtyUuids] = useState<string[]>([]);

  useEffect(() => {
    const nextPath = `/publications/editor/${uuid}/${builder}`;

    if (pathname === nextPath && fragments[builder]) {
      return;
    }

    router.push(nextPath);

    if (!fragments[builder]) {
      const fragment = doc.getXmlFragment(builder);
      setFragments((prev) => ({
        ...prev,
        [builder]: fragment,
      }));
    }
  }, [uuid, builder, pathname, router, doc, fragments]);

  const getFragment = useCallback((): XmlFragment => {
    if (!builder) {
      throw new Error('Builder is not set');
    }

    return fragments[builder];
  }, [fragments, builder]);

  const save = useCallback(async () => {
    console.log('Saving document state...');
  }, []);

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

    console.log(uuids);

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

  return (
    <EditorContext.Provider
      value={{
        uuid,
        builder,
        doc,
        dirtyUuids,
        getFragment,
        setDoc,
        setBuilder,
        save,
        startObserving,
        stopObserving,
      }}
    >
      <EditorSidebar active={builder || 'body'} onClick={setBuilder}>
        <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4 py-(--header-height)">
          {children}
        </div>
      </EditorSidebar>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
