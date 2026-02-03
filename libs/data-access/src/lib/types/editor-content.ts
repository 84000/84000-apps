import type { JSONContent } from '@tiptap/core';

/**
 * TipTap editor content item with 84000-specific attributes.
 * Used for passage blocks in the translation editor and reader.
 */
export type TranslationEditorContentItem = JSONContent & {
  attrs?: {
    uuid?: string | null;
    class?: string | null;
    type?: string | null;
    sort?: number | null;
  };
};

/**
 * TipTap editor content - either a single item or array of items.
 */
export type TranslationEditorContent =
  | TranslationEditorContentItem[]
  | TranslationEditorContentItem;
