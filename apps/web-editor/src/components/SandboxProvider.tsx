'use client';

import { Editor, JSONContent } from '@tiptap/react';
import { Format, Slug } from '@lib-editing/fixtures/types';
import { ReactNode, createContext, useContext, useState } from 'react';

export interface SandboxContextType {
  slug?: Slug;
  setSlug: (slug: Slug | undefined) => void;
  format?: Format;
  setFormat: (format: Format | undefined) => void;
  editor?: Editor;
  setEditor: (editor: Editor) => void;
  content?: JSONContent;
  setContent: (content: JSONContent) => void;
}

const SandboxContext = createContext<SandboxContextType>({
  setSlug: () => {
    throw new Error('setSlug function must be overridden');
  },
  setFormat: () => {
    throw new Error('setFormat function must be overridden');
  },
  setEditor: () => {
    throw new Error('setEditor function must be overridden');
  },
  setContent: () => {
    throw new Error('setContent function must be overridden');
  },
});

export const SandboxProvider = ({ children }: { children: ReactNode }) => {
  const [slug, setSlug] = useState<Slug>();
  const [format, setFormat] = useState<Format>();
  const [editor, setEditor] = useState<Editor>();
  const [content, setContent] = useState<JSONContent>();

  return (
    <SandboxContext.Provider
      value={{
        slug,
        setSlug,
        format,
        setFormat,
        editor,
        setEditor,
        content,
        setContent,
      }}
    >
      {children}
    </SandboxContext.Provider>
  );
};

export const useSandbox = () => {
  const context = useContext(SandboxContext);
  if (context === undefined) {
    throw new Error('useSandbox must be used within a SandboxProvider');
  }
  return context;
};
