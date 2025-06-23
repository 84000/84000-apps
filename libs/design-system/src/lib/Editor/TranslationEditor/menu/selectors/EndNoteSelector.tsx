import { Button } from '../../../../Button/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../Popover/Popover';
import { cn } from '@lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { AsteriskIcon } from 'lucide-react';
import { SelectorInputField } from '../../../menus/SelectorInputField';

export const EndNoteSelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive('endNoteLink'),
    }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-none flex-shrink-0"
        >
          <AsteriskIcon
            className={cn(
              'size-4',
              editorState.isActive ? 'text-primary' : 'text-muted-foreground',
            )}
            strokeWidth={2.5}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-fit shadow-xl rounded-md border p-1"
        align="end"
        noPortal
      >
        <SelectorInputField
          editor={editor}
          type="endNoteLink"
          attr="endNote"
          placeholder="Add end note uuid..."
          onSubmit={(value) => {
            if (value) {
              editor.chain().focus().setEndNoteLink(value).run();
            } else {
              editor.chain().focus().unsetEndNoteLink().run();
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
