'use client';

import { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import {
  ScrollArea,
  Separator,
  ScrollBar,
} from '@eightyfourthousand/design-system';
import { useRef } from 'react';
import { TranslationTextButtons } from './selectors/TranslationTextButtons';
import { ParagraphButtons } from './selectors/ParagraphButtons';
import { TranslationNodeSelector } from './selectors/TranslationNodeSelector';
import { useDismissBubbleMenu } from './useDismissBubbleMenu';
import { TextAlignSelector, WhitespaceSelector } from './selectors';

export const TranslationBubbleMenu = ({
  editor,
}: {
  editor: Editor | null;
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  useDismissBubbleMenu(editor, menuRef);

  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      ref={menuRef}
      editor={editor}
      appendTo={() => document.body}
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
      <ScrollArea className="max-w-[90vw] rounded-md border bg-popover shadow-xl z-50">
        <div className="flex">
          <TranslationNodeSelector editor={editor} />
          <TextAlignSelector editor={editor} />
          <WhitespaceSelector editor={editor} />
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
