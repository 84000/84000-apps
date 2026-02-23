'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { addBookmark, isBookmarked, removeBookmark } from './local-storage';

type BookmarkOptions = {
  type: string;
  subType?: string;
  tab: string;
};

const listeners = new Set<() => void>();

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function emitChange() {
  listeners.forEach((l) => l());
}

export function useBookmark(uuid: string, options?: BookmarkOptions) {
  const bookmarked = useSyncExternalStore(
    subscribe,
    () => isBookmarked(uuid),
    () => false,
  );

  const toggle = useCallback(() => {
    if (isBookmarked(uuid)) {
      removeBookmark(uuid);
    } else {
      addBookmark({
        uuid,
        type: options?.type ?? '',
        subType: options?.subType,
        tab: options?.tab ?? '',
      });
    }
    emitChange();
  }, [uuid, options?.type, options?.subType, options?.tab]);

  return { isBookmarked: bookmarked, toggle };
}
