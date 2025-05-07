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
  const router = useRouter();
  const pathname = usePathname();

  const pathEnd = pathname.split('/').pop();
  const isUuidPath = pathEnd === uuid;
  const initialBuilder = isUuidPath ? 'body' : (pathEnd as EditorBuilderType);

  const [builder, setBuilder] = useState<EditorBuilderType>(initialBuilder);

  const onBuilderChanged = (builder: EditorBuilderType) => {
    setBuilder(builder);

    const nextPath = `/publications/editor/${uuid}/${builder}`;

    if (pathname === nextPath) {
      return;
    }

    router.push(nextPath);
  };

  useEffect(() => {
    onBuilderChanged(initialBuilder);
  });

  return (
    <EditorContext.Provider value={{ builder, setBuilder, uuid }}>
      <EditorSidebar active={builder} onClick={onBuilderChanged}>
        <div className="flex flex-col w-full xl:px-32 lg:px-16 md:px-8 px-4 py-(--header-height)">
          {children}
        </div>
      </EditorSidebar>
    </EditorContext.Provider>
  );
};

export const useEditorState = () => useContext(EditorContext);
