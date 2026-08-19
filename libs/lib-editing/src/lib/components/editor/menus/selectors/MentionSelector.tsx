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
import { AtSignIcon } from 'lucide-react';
import { useState } from 'react';
import { MentionSearch } from '../../extensions/Mention/MentionSearch';

/**
 * Bubble-menu entry point for inserting a mention over the selection. Mirrors
 * GlossarySelector: the selected text seeds the entity search, so selecting the
 * reference an author typed by hand ("2.25", "Introduction") and clicking `@`
 * opens the picker already querying for it.
 *
 * A mention is an inline atom that renders its own label, not a mark that wraps
 * text, so inserting one replaces the selection — the hand-typed reference gives
 * way to a live label that tracks its target.
 */
export const MentionSelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive('mention'),
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
          <AtSignIcon
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
        <MentionSearch
          initialQuery={editor.state.doc.textBetween(
            editor.state.selection.from,
            editor.state.selection.to,
            ' ',
          )}
          onSelect={({ entity, linkType, label, isSameWork }) => {
            // `setMention` inserts over the live selection, replacing it. The
            // label is passed for immediate display only; it is not persisted,
            // so the canonical value resolves on load.
            editor
              .chain()
              .focus()
              .setMention(entity, linkType, label, isSameWork)
              .run();
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};
