'use client';

import { cn } from '@eightyfourthousand/lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@eightyfourthousand/design-system';
import { BookOpenTextIcon } from 'lucide-react';
import { useState } from 'react';
import { GlossarySearch } from '../../extensions/GlossaryInstance/GlossarySearch';

export const GlossarySelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive('glossaryInstance'),
    }),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="px-2 rounded-none flex-shrink-0"
        >
          <BookOpenTextIcon
            className={cn(
              'size-4',
              editorState.isActive
                ? 'text-foreground'
                : 'text-muted-foreground',
            )}
            strokeWidth={2.5}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 shadow-xl rounded-md border p-2"
        align="end"
        noPortal
      >
        <GlossarySearch
          onSelect={({ glossary, authority }) => {
            const { to } = editor.state.selection;
            editor
              .chain()
              .focus()
              .setGlossaryInstance({ glossary, authority })
              .setTextSelection(to)
              .run();
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
