import { cn } from '@lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@design-system';
import { BookOpenTextIcon } from 'lucide-react';
import { SelectorInputField } from './SelectorInputField';

export const GlossarySelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive('glossaryInstance'),
    }),
  });

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="px-2 rounded-none flex-shrink-0"
        >
          <BookOpenTextIcon
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
          type="glossaryInstance"
          attr="glossary"
          placeholder="Add glossary uuid..."
          onSubmit={(value) => {
            if (value) {
              editor.chain().focus().setGlossaryInstance(value).run();
            } else {
              editor.chain().focus().unsetGlossaryInstance().run();
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
