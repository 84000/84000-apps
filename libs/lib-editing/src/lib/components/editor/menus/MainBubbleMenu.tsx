'use client';

import { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react/menus';
import { ScrollArea, Separator, ScrollBar } from '@eightyfourthousand/design-system';
import { useRef } from 'react';
import { NodeSelector, TextAlignSelector, TextButtons } from './selectors';
import { useDismissBubbleMenu } from './useDismissBubbleMenu';

export const MainBubbleMenu = ({ editor }: { editor: Editor | null }) => {
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
          <NodeSelector editor={editor} />
          <Separator orientation="vertical" className="h-10" />
          <TextButtons editor={editor} />
          <Separator orientation="vertical" className="h-10" />
          <TextAlignSelector editor={editor} />
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </BubbleMenu>
  );
};
