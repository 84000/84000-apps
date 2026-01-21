'use client';

import { useRef } from 'react';

export interface DirtyStore {
  isDirty: boolean;
  listeners: Set<() => void>;
  subscribe(listener: () => void): () => void;
  setDirty(value: boolean): void;
  getSnapshot(): boolean;
}

export const useDirtyStore = (): DirtyStore => {
  const storeRef = useRef<DirtyStore>({
    isDirty: false,
    listeners: new Set<() => void>(),
    subscribe(listener: () => void) {
      this.listeners.add(listener);
      return () => this.listeners.delete(listener);
    },
    setDirty(value: boolean) {
      if (this.isDirty !== value) {
        this.isDirty = value;
        this.listeners.forEach((listener) => listener());
      }
    },
    getSnapshot() {
      return this.isDirty;
    },
  });

  return storeRef.current;
};
