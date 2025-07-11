import { Button } from '../../../../Button/Button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../../../../Popover/Popover';
import { cn } from '@lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import { LinkIcon } from 'lucide-react';
import { SelectorInputField } from '../../../menus/SelectorInputField';

export const LinkSelector = ({ editor }: { editor: Editor }) => {
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive('link'),
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
          <LinkIcon
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
          type="link"
          attr="href"
          placeholder="Add link..."
          onSubmit={(value) => {
            if (value) {
              editor
                .chain()
                .focus()
                .extendMarkRange('link')
                .setLink({ href: value })
                .run();
            } else {
              editor.chain().focus().unsetLink().run();
            }
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
