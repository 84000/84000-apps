import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@eightyfourthousand/design-system';
import { Editor } from '@tiptap/core';
import { BookOpenIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { GlossarySearch } from './GlossarySearch';
import { findMarkByUuid } from '../../util';
import { useNavigation } from '../../../shared';

const EDITOR_UPDATE_DELAY_MS = 100;

export const GlossaryInstance = ({
  uuid,
  glossary,
  editor,
  anchor,
  close,
  setHoverCardEditing,
}: {
  uuid: string;
  glossary: string;
  editor: Editor;
  anchor: HTMLElement;
  close: () => void;
  setHoverCardEditing: (isEditing: boolean) => void;
}) => {
  const [isEditing, setIsEditingLocal] = useState(false);
  const [english, setEnglish] = useState<string | null>(null);
  const [termNumber, setTermNumber] = useState<number | null>(null);
  const markText = anchor.textContent ?? '';
  const { fetchGlossaryTerm } = useNavigation();

  useEffect(() => {
    let cancelled = false;
    if (!glossary) {
      setEnglish(null);
      setTermNumber(null);
      return;
    }
    fetchGlossaryTerm(glossary).then((term) => {
      if (!cancelled) {
        setEnglish(term?.names.english ?? null);
        setTermNumber(term?.termNumber ?? null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [glossary, fetchGlossaryTerm]);

  const setIsEditing = useCallback(
    (editing: boolean) => {
      setIsEditingLocal(editing);
      setHoverCardEditing(editing);
    },
    [setHoverCardEditing],
  );

  const deleteLink = useCallback(() => {
    close();

    setTimeout(() => {
      const range = findMarkByUuid({
        editor,
        uuid,
        markType: 'glossaryInstance',
      });
      if (!range) {
        console.warn('GlossaryInstance mark not found in the document.');
        return;
      }

      const { from, to, mark } = range;
      const { tr } = editor.state;
      tr.removeMark(from, to, mark.type);
      editor.view.dispatch(tr);
    }, EDITOR_UPDATE_DELAY_MS);
  }, [editor, uuid, close]);

  const updateGlossary = useCallback(
    ({
      glossary: newGlossary,
      authority: newAuthority,
    }: {
      glossary: string;
      authority: string;
    }) => {
      close();

      setTimeout(() => {
        const range = findMarkByUuid({
          editor,
          uuid,
          markType: 'glossaryInstance',
        });
        if (!range) {
          console.warn('GlossaryInstance mark not found in the document.');
          return;
        }

        const { from, to, mark } = range;
        const { tr } = editor.state;
        tr.removeMark(from, to, mark.type);
        tr.addMark(
          from,
          to,
          mark.type.create({
            ...mark.attrs,
            glossary: newGlossary,
            authority: newAuthority,
          }),
        );
        editor.view.dispatch(tr);

        anchor.setAttribute('glossary', newGlossary);
        anchor.setAttribute('authority', newAuthority);
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [editor, uuid, anchor, close],
  );

  return (
    <div className="flex justify-between gap-2 p-2 w-fit max-w-80">
      <BookOpenIcon className="text-primary my-auto size-5 [&_svg]:size-4" />
      {termNumber !== null && (
        <span className="text-accent text-xs my-auto shrink-0">
          g.{termNumber}
        </span>
      )}
      <span className="truncate text-primary text-sm my-auto">
        {english ?? markText}
      </span>
      <span className="flex-grow" />
      <Popover open={isEditing} onOpenChange={(next) => setIsEditing(next)}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="size-6 [&_svg]:size-4">
            <PencilIcon className="text-primary my-auto" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-72 shadow-xl rounded-md border p-2"
          align="end"
          noPortal
        >
          <GlossarySearch initialQuery={markText} onSelect={updateGlossary} />
        </PopoverContent>
      </Popover>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 [&_svg]:size-4"
        onClick={deleteLink}
      >
        <Trash2Icon className="text-destructive my-auto" />
      </Button>
    </div>
  );
};
