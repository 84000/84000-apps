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
import { useCallback, useContext, useRef, useState } from 'react';
import { GlossarySearch } from '../../extensions/GlossaryInstance/GlossarySearch';
import { EditorContext } from '../../editor-context';
import { GlossaryEntryForm } from '../../../shared/glossary/GlossaryEntryForm';
import { useNavigation } from '../../../shared';

/** The passage text the popover links, as selected when it opened. */
type Range = { from: number; to: number; text: string };

export const GlossarySelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range | null>(null);
  // Read by a create that finishes after the popover has closed.
  const openRef = useRef(false);
  const [creating, setCreating] = useState(false);
  const { editPermitted } = useContext(EditorContext);
  const { uuid: workUuid } = useNavigation();
  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive('glossaryInstance'),
    }),
  });

  const onOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        const { from, to } = editor.state.selection;
        setRange({
          from,
          to,
          text: editor.state.doc.textBetween(from, to, ' '),
        });
      }
      openRef.current = next;
      setCreating(false);
      setOpen(next);
    },
    [editor],
  );

  const link = useCallback(
    (glossary: string) => {
      if (!openRef.current) return;
      const { from, to } = range ?? editor.state.selection;
      // The passage changed under the popover: its range no longer holds the text.
      if (range && editor.state.doc.textBetween(from, to, ' ') !== range.text) {
        onOpenChange(false);
        return;
      }
      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setGlossaryInstance({ glossary })
        .setTextSelection(to)
        .run();
      onOpenChange(false);
    },
    [editor, range, onOpenChange],
  );

  const selected = range?.text ?? '';
  const canCreate = editPermitted === true && !!workUuid;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
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
        className={cn(
          'shadow-xl rounded-md border p-2',
          creating ? 'w-96' : 'w-72',
        )}
        align="end"
        noPortal
      >
        {creating && workUuid ? (
          <GlossaryEntryForm
            workUuid={workUuid}
            initialEnglish={selected}
            onCreated={(entry) => link(entry.uuid)}
            onPickExisting={(match) => link(match.uuid)}
            onCancel={() => setCreating(false)}
          />
        ) : (
          <GlossarySearch
            initialQuery={selected}
            onSelect={({ glossary }) => link(glossary)}
            onCreate={canCreate ? () => setCreating(true) : undefined}
          />
        )}
      </PopoverContent>
    </Popover>
  );
};
