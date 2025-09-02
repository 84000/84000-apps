export const LIBRARY_ITEMS = [
  'publications',
  'passages',
  'glossaries',
  'bibliographies',
  'searches',
] as const;

export type LibraryItemType = (typeof LIBRARY_ITEMS)[number];

export type UserLibraryItem = {
  uuid: string;
  type: LibraryItemType;
  createdAt: string;
  featured: boolean;
};

export type UserPassageWork = {
  uuid: string;
  toh: string;
};

export type UserPassageItem = {
  uuid: string;
  toh: string;
  label: string;
  content: string;
  work: UserPassageWork;
};
