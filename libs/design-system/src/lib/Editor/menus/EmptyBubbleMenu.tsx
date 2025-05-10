import { Editor } from '@tiptap/core';
import { BubbleMenu } from '@tiptap/react';
import { ScrollArea, ScrollBar } from '../../ScrollArea/ScrollArea';

export const EmptyBubbleMenu = ({ editor }: { editor: Editor | null }) => {
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

        return true;
      }}
    >
      <ScrollArea className="max-w-[90vw] rounded-md border bg-popover shadow-xl">
        <div className="py-2 px-4 text-muted-foreground italic">
          No menu options available
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </BubbleMenu>
  );
};
