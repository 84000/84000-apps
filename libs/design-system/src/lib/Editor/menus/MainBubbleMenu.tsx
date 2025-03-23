import { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react';
import { NodeSelector, TextAlignSelector, TextButtons } from './selectors';
import { ScrollArea, ScrollBar } from '../../ScrollArea/ScrollArea';
import { Separator } from '../../Separator/Separator';

export const MainBubbleMenu = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{
        placement: 'top',
        hideOnClick: false,
        moveTransition: 'transform 0.15s ease-out',
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
      <ScrollArea className="max-w-[90vw] rounded-md border bg-popover shadow-xl">
        <div className="flex">
          <NodeSelector editor={editor} />
          <Separator orientation="vertical" className="h-10" />
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
