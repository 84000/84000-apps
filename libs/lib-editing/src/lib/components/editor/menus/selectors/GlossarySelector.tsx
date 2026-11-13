'use client';

import { cn } from '@eightyfourthousand/lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  toast,
} from '@eightyfourthousand/design-system';
import { BookOpenTextIcon } from 'lucide-react';
import { useCallback, useContext, useRef, useState } from 'react';
import { GlossarySearch } from '../../extensions/GlossaryInstance/GlossarySearch';
import { EditorContext } from '../../editor-context';
import { GlossaryEntryForm } from '../../../shared/glossary/GlossaryEntryForm';
import { useNavigation } from '../../../shared';

/** The passage text the popover links, as selected when it opened. */
type Range = { from: number; to: number; text: string; opening: number };

export const GlossarySelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range | null>(null);
  // Which opening is showing, if any: a create that finishes later checks it.
  const openings = useRef({ count: 0, showing: 0 });
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
        const opening = ++openings.current.count;
        setRange({
          from,
          to,
          text: editor.state.doc.textBetween(from, to, ' '),
          opening,
        });
        openings.current.showing = opening;
      } else {
        openings.current.showing = 0;
      }
      setCreating(false);
      setOpen(next);
    },
    [editor],
  );

  const link = useCallback(
    (glossary: string, created = false) => {
      if (!range) return;
      const { from, to, text, opening } = range;
      // Closed, reopened or edited meanwhile: the range may not hold the text.
      const closed = openings.current.showing !== opening;
      if (closed || editor.state.doc.textBetween(from, to, ' ') !== text) {
        const reason = closed ? 'the popover closed' : 'the text changed';
        toast(
          created
            ? `Entry created, but not linked because ${reason}.`
            : `Not linked because ${reason}.`,
        );
        if (!closed) onOpenChange(false);
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
            onCreated={(entry) => link(entry.uuid, true)}
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
