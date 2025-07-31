'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Doc, XmlFragment } from 'yjs';
import { EditorBuilderType } from './EditorBuilderType';
import { EditorSidebar } from './EditorSidebar';
import { usePathname, useRouter } from 'next/navigation';

interface EditorContextState {
  doc?: Doc;
  uuid: string;
  builder: EditorBuilderType;
  dirtyUuids: string[];
  setBuilder: (active: EditorBuilderType) => void;
  setDoc: (doc: Doc) => void;
  save: () => Promise<void>;
}

export const EditorContext = createContext<EditorContextState>({
  uuid: '',
  builder: 'body',
  dirtyUuids: [],
  setBuilder: () => {
    throw Error('Not implemented');
  },
  setDoc: () => {
    throw Error('Not implemented');
  },
  save: async () => {
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
  const [dirtyUuids, setDirtyUuids] = useState<string[]>([]);

  const onBuilderChanged = (builder: EditorBuilderType) => {
    setBuilder(builder);

    const nextPath = `/publications/editor/${uuid}/${builder}`;

    if (pathname === nextPath) {
      return;
    }

    router.push(nextPath);
  };

  const save = useCallback(async () => {
    console.log('Saving document state...');
  }, []);

  useEffect(() => {
    onBuilderChanged(initialBuilder);
  });

  useEffect(() => {
    if (!doc) {
      return;
    }

    doc.getXmlElement('default').observeDeep((evt, txn) => {
      if (!txn.local) {
        return;
      }
      const uuids: string[] = [];
      evt.forEach((item) => {
        const node: XmlFragment = (
          item.target instanceof XmlFragment ? item.target : item.target.parent
        )?.toDOM();

        if (!node || !(node instanceof HTMLElement)) {
          return;
        }

        const uuid = node.getAttribute('uuid');

        if (uuid) {
          console.log(item.changes);
          uuids.push(uuid);
        }
      });

      setDirtyUuids((prev) => {
        return [...new Set([...prev, ...uuids])];
      });
    });
  }, [doc]);

  return (
    <EditorContext.Provider
      value={{ uuid, builder, doc, dirtyUuids, setDoc, setBuilder, save }}
    >
      <EditorSidebar active={builder} onClick={onBuilderChanged}>
        <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4 py-(--header-height)">
          {children}
        </div>
      </EditorSidebar>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
