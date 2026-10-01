import { Editor } from '@tiptap/core';

/** One entry in an `endNoteLink` mark's `notes` attribute. */
export interface EndNoteLinkNote {
  uuid: string;
  endNote: string;
  label?: string;
  location?: string;
  toh?: string;
}

interface MarkRange {
  from: number;
  to: number;
  mark: ReturnType<Editor['state']['doc']['resolve']> extends never
    ? never
    : // eslint-disable-next-line @typescript-eslint/no-explicit-any
      any;
  note: EndNoteLinkNote;
}

/**
 * Scan main editor from start to `cursorPos`, collecting `endNoteLink` marks.
 * Return the last one's `endNote` UUID and its position info.
 */
export function findLastEndNoteLinkBefore(
  editor: Editor,
  cursorPos: number,
): { endNote: string; from: number; to: number } | undefined {
  const { doc } = editor.state;
  let last: { endNote: string; from: number; to: number } | undefined;

  doc.descendants((node, pos) => {
    if (pos >= cursorPos) return false;

    for (const mark of node.marks) {
      if (mark.type.name === 'endNoteLink') {
        const notes: EndNoteLinkNote[] = mark.attrs.notes || [];
        for (const note of notes) {
          if (note.endNote) {
            last = {
              endNote: note.endNote,
              from: pos,
              to: pos + node.nodeSize,
            };
          }
        }
      }
    }
    return true;
  });

  return last;
}

/**
 * Traverse the editor doc, return all mark ranges where
 * notes[].endNote === endNotePassageUuid.
 */
export function findAllEndnoteLinksForPassage(
  editor: Editor,
  endNotePassageUuid: string,
): MarkRange[] {
  const { doc } = editor.state;
  const results: MarkRange[] = [];

  doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type.name === 'endNoteLink') {
        const notes: EndNoteLinkNote[] = mark.attrs.notes || [];
        for (const note of notes) {
          if (note.endNote === endNotePassageUuid) {
            results.push({
              from: pos,
              to: pos + node.nodeSize,
              mark,
              note,
            });
          }
        }
      }
    }
    return true;
  });

  return results;
}

/**
 * Batch-remove all `endNoteLink` marks pointing to a given passage UUID
 * using a single transaction.
 */
export function removeAllEndnoteLinksForPassage(
  editor: Editor,
  endNotePassageUuid: string,
): void {
  const ranges = findAllEndnoteLinksForPassage(editor, endNotePassageUuid);
  if (ranges.length === 0) return;

  const { tr } = editor.state;

  for (const { from, to, mark, note } of ranges) {
    tr.removeMark(from, to, mark.type);
    // If the mark has other notes besides the one we're removing, re-add it
    const remainingNotes = (mark.attrs.notes || []).filter(
      (n: EndNoteLinkNote) => n.uuid !== note.uuid,
    );
    if (remainingNotes.length > 0) {
      tr.addMark(
        from,
        to,
        mark.type.create({ ...mark.attrs, notes: remainingNotes }),
      );
    }
  }

  editor.view.dispatch(tr);
}
