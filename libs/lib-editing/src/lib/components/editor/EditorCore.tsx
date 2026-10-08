'use client';

import {
  EditorContent,
  type Content,
  type Editor,
  type Extensions,
  type UseEditorOptions,
} from '@tiptap/react';
import type { ReactNode } from 'react';
import { useBlockEditor } from './hooks/useBlockEditor';

/**
 * Renders extra UI attached to the editor, such as a bubble menu. Receives
 * the editor instance, which is `null` until the editor has mounted.
 */
export type EditorMenuSlot = (editor: Editor | null) => ReactNode;

/** Props for {@link EditorCore}. */
export type EditorCoreProps = Omit<
  UseEditorOptions,
  'content' | 'extensions' | 'editable' | 'autofocus'
> & {
  content: Content;
  /** The full extension set. Nothing is added to it. */
  extensions: Extensions;
  isEditable?: boolean;
  /** Focus the start of the document on mount (see `useBlockEditor`). */
  autofocus?: boolean;
  /** See `useBlockEditor`. Default: true. */
  undoableInitialContent?: boolean;
  /** Optional UI rendered after the editor content, e.g. a bubble menu. */
  menu?: EditorMenuSlot;
  className?: string;
};

/**
 * The editor surface with nothing translation-specific in it: the caller
 * supplies every extension and, optionally, a menu.
 *
 * Imports only `@tiptap/*`, react and `useBlockEditor` by file path, so it
 * bundles without Next, client-graphql or Yjs. Keep it that way.
 */
export const EditorCore = ({
  content,
  extensions,
  isEditable = true,
  menu,
  className = 'relative flex flex-col flex-1 h-full',
  ...options
}: EditorCoreProps) => {
  const { editor } = useBlockEditor({
    ...options,
    extensions,
    content,
    isEditable,
  });
  return (
    <div className={className}>
      <EditorContent className="flex-1" editor={editor} />
      {menu?.(editor)}
    </div>
  );
};
