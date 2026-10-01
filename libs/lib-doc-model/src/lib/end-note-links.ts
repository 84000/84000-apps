import type { JSONContent } from '@tiptap/core';
import { mapMarks } from './marks';

type Note = { endNote?: string };

/**
 * A passage's content without its links to any of `endNotes`, or null when it
 * has none.
 *
 * One `endNoteLink` mark holds every note at its position, so a link is taken
 * out of the mark, and the mark goes only when no note is left.
 */
export const withoutEndNoteLinks = (
  content: JSONContent,
  endNotes: ReadonlySet<string>,
): JSONContent | null =>
  mapMarks(content, (mark) => {
    if (mark.type !== 'endNoteLink') return mark;
    const notes = (mark.attrs?.notes ?? []) as Note[];
    const kept = notes.filter(
      (note) => !note.endNote || !endNotes.has(note.endNote),
    );
    if (kept.length === notes.length) return mark;
    return kept.length
      ? { ...mark, attrs: { ...mark.attrs, notes: kept } }
      : null;
  });

/**
 * A passage's content with each endnote link's number brought up to date, or
 * null when none changed.
 *
 * `labelOf` gives an endnote's current label, or undefined to leave its links
 * as they are.
 */
export const withEndNoteLabels = (
  content: JSONContent,
  labelOf: (endNote: string) => string | undefined,
): JSONContent | null => {
  let changed = false;

  const visit = (item: JSONContent): JSONContent => {
    const marks = item.marks?.map((mark) => {
      if (mark.type !== 'endNoteLink') return mark;
      const notes = (mark.attrs?.notes ?? []) as (Note & { label?: string })[];
      let relabelled = false;
      const next = notes.map((note) => {
        const label = note.endNote ? labelOf(note.endNote) : undefined;
        if (label === undefined || label === note.label) return note;
        relabelled = true;
        return { ...note, label };
      });
      if (!relabelled) return mark;
      changed = true;
      return { ...mark, attrs: { ...mark.attrs, notes: next } };
    });
    const children = item.content?.map(visit);
    return {
      ...item,
      ...(marks ? { marks } : {}),
      ...(children ? { content: children } : {}),
    };
  };

  const result = visit(content);
  return changed ? result : null;
};
