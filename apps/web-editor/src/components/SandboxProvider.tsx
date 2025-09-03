'use client';

import { Format, Slug } from '@lib-editing/fixtures/types';
import { ReactNode, createContext, useContext, useState } from 'react';

export interface SandboxContextType {
  slug?: Slug;
  setSlug: (slug: Slug | undefined) => void;
  format?: Format;
  setFormat: (format: Format | undefined) => void;
}

const SandboxContext = createContext<SandboxContextType>({
  setSlug: () => {
    throw new Error('setSlug function must be overridden');
  },
  setFormat: () => {
    throw new Error('setFormat function must be overridden');
  },
});

export const SandboxProvider = ({ children }: { children: ReactNode }) => {
  const [slug, setSlug] = useState<Slug>();
  const [format, setFormat] = useState<Format>();
  return (
    <SandboxContext.Provider value={{ slug, setSlug, format, setFormat }}>
      <div className="[--header-height:calc(--spacing(20))]">{children}</div>
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
