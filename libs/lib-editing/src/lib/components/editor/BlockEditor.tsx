'use client';

import type { Content, Extensions, UseEditorOptions } from '@tiptap/react';
import { EditorCore, type EditorMenuSlot } from './EditorCore';
import { useDefaultExtensions } from './hooks';
import { MainBubbleMenu } from './menus/MainBubbleMenu';

export type BlockEditorContent = Content;

const defaultBubbleMenu: EditorMenuSlot = (editor) => (
  <MainBubbleMenu editor={editor} />
);

/**
 * The block editor with the translation defaults: `useDefaultExtensions()`
 * and `MainBubbleMenu`. Pass `extensions` to replace the extension set and
 * `bubbleMenu` to replace the menu (`null` renders none).
 */
export const BlockEditor = ({
  content,
  isEditable = true,
  onUpdate,
  onCreate,
  extensions,
  bubbleMenu = defaultBubbleMenu,
}: UseEditorOptions & {
  content: BlockEditorContent;
  isEditable?: boolean;
  /** Replaces the default extension set when given. */
  extensions?: Extensions;
  /** Replaces `MainBubbleMenu`; `null` renders no menu. */
  bubbleMenu?: EditorMenuSlot | null;
}) => {
  const { extensions: defaults } = useDefaultExtensions();
  return (
    <EditorCore
      content={content}
      extensions={extensions ?? defaults}
      isEditable={isEditable}
      onCreate={onCreate}
      onUpdate={onUpdate}
      menu={bubbleMenu ?? undefined}
    />
  );
};

export default BlockEditor;
