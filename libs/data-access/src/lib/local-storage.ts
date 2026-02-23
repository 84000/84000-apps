export type BookmarkItem = {
  type: string;
  subType?: string;
  tab: string;
  uuid: string;
};

const LIBRARY_KEY = 'library';

export function getBookmarks(): BookmarkItem[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as BookmarkItem[];
  } catch {
    return [];
  }
}

export function addBookmark(item: BookmarkItem): void {
  const bookmarks = getBookmarks().filter((b) => b.uuid !== item.uuid);
  bookmarks.push(item);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(bookmarks));
}

export function removeBookmark(uuid: string): void {
  const bookmarks = getBookmarks().filter((b) => b.uuid !== uuid);
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(bookmarks));
}

export function isBookmarked(uuid: string): boolean {
  return getBookmarks().some((b) => b.uuid === uuid);
}
