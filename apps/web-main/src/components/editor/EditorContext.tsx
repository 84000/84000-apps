'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { EditorBuilderType } from './EditorBuilderType';
import { EditorSidebar } from './EditorSidebar';
import { usePathname, useRouter } from 'next/navigation';

interface EditorContextState {
  uuid: string;
  builder: EditorBuilderType;
  setBuilder: (active: EditorBuilderType) => void;
}

export const EditorContext = createContext<EditorContextState>({
  uuid: '',
  builder: 'body',
  setBuilder: () => {
    throw Error('Not implemented');
  },
});

interface EditorContextProps {
  uuid: string;
  children: React.ReactNode;
}

export const EditorContextProvider = ({
  uuid,
  children,
}: EditorContextProps) => {
  const [builder, setBuilder] = useState<EditorBuilderType>('body');
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    router.push(`/publications/editor/${uuid}/${builder}`);
  }, [builder, router, uuid, pathname]);

  return (
    <EditorContext.Provider value={{ builder, setBuilder, uuid }}>
      <EditorSidebar onClick={setBuilder}>
        <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4 pb-(--header-height)">
          {children}
        </div>
      </EditorSidebar>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
