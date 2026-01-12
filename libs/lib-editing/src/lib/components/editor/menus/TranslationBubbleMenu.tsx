'use client';

import { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { ScrollArea, Separator, ScrollBar } from '@design-system';
import { TranslationTextButtons } from './selectors/TranslationTextButtons';
import { ParagraphButtons } from './selectors/ParagraphButtons';
import { TranslationNodeSelector } from './selectors/TranslationNodeSelector';

export const TranslationBubbleMenu = ({
  editor,
}: {
  editor: Editor | null;
}) => {
  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: 'top',
        offset: 6,
      }}
      shouldShow={({ editor, state }) => {
        const { selection } = state;
        const { empty } = selection;

        if (!editor.isEditable) {
          return false;
        }

        if (empty) {
          return false;
        }

        if (editor.isActive('codeBlock')) {
          return false;
        }

        return true;
      }}
    >
      <ScrollArea className="max-w-[90vw] rounded-md border bg-popover shadow-xl z-10">
        <div className="flex">
          <TranslationNodeSelector editor={editor} />
          <Separator orientation="vertical" className="h-10" />
          <ParagraphButtons editor={editor} />
          <Separator orientation="vertical" className="h-10" />
          <TranslationTextButtons editor={editor} />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </BubbleMenu>
  );
};
