'use client';

import { useState } from 'react';

export interface DirtyStore {
  isDirty: boolean;
  listeners: Set<() => void>;
  subscribe(listener: () => void): () => void;
  setDirty(value: boolean): void;
  getSnapshot(): boolean;
}

export const useDirtyStore = (): DirtyStore => {
  // A lazy useState initialiser gives the same one-per-component instance as a
  // ref, but is safe to read during render. It also avoids rebuilding the
  // object literal on every render, which `useRef` did.
  const [store] = useState<DirtyStore>(() => ({
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
  }));

  return store;
};
