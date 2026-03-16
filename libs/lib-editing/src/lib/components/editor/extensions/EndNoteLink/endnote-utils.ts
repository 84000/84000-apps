import { Editor } from '@tiptap/core';
import { incrementLabel } from '../Passage/label';

interface EndNoteLinkNote {
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
            last = { endNote: note.endNote, from: pos, to: pos + node.nodeSize };
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
      tr.addMark(from, to, mark.type.create({ ...mark.attrs, notes: remainingNotes }));
    }
  }

  editor.view.dispatch(tr);
}

/**
 * Find a passage node in the endnotes editor by UUID.
 * Returns { pos, node } or undefined.
 */
export function findEndnotePassageNode(
  editor: Editor,
  passageUuid: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { pos: number; node: any } | undefined {
  const { doc } = editor.state;
  let result: { pos: number; node: typeof doc } | undefined;

  doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name === 'passage' && node.attrs.uuid === passageUuid) {
      result = { pos, node };
      return false;
    }
    return true;
  });

  return result;
}

/**
 * Get the last passage node in the endnotes editor.
 * Returns { label, sort, uuid } or undefined if no passages exist.
 */
export function getLastEndnoteInEditor(
  editor: Editor,
): { label: string; sort: number; uuid: string } | undefined {
  const { doc } = editor.state;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let last: { label: string; sort: number; uuid: string; pos: number } | undefined;

  doc.descendants((node, pos) => {
    if (node.type.name === 'passage') {
      last = {
        label: node.attrs.label || '',
        sort: node.attrs.sort ?? 0,
        uuid: node.attrs.uuid,
        pos,
      };
    }
    return true;
  });

  return last
    ? { label: last.label, sort: last.sort, uuid: last.uuid }
    : undefined;
}

/**
 * Insert a new empty endnote passage at the end of the endnotes editor document.
 */
export function insertEndnotePassage(
  editor: Editor,
  { label, sort, uuid }: { label: string; sort: number; uuid: string },
): void {
  const { state } = editor;
  const { tr, schema } = state;
  const passageType = schema.nodes.passage;
  const paragraphType = schema.nodes.paragraph;

  if (!passageType || !paragraphType) {
    console.warn('Required node types not found in schema');
    return;
  }

  const newPassage = passageType.create(
    { label, sort, uuid, type: 'endnotes' },
    paragraphType.create(),
  );

  // Insert at end of document
  const endPos = state.doc.content.size;
  tr.insert(endPos, newPassage);
  editor.view.dispatch(tr);
}

/**
 * Delete a passage node from the endnotes editor by UUID,
 * then normalize labels of subsequent passages.
 */
export function deleteEndnotePassageNode(
  editor: Editor,
  passageUuid: string,
): void {
  const found = findEndnotePassageNode(editor, passageUuid);
  if (!found) return;

  const { pos, node } = found;
  const { tr } = editor.state;

  // Find the passage before the deleted one for label normalization
  let prevPassageLabel: string | undefined;
  editor.state.doc.descendants((n, p) => {
    if (p >= pos) return false;
    if (n.type.name === 'passage' && n.attrs.label) {
      prevPassageLabel = n.attrs.label;
    }
    return true;
  });

  // Delete the passage node
  tr.delete(pos, pos + node.nodeSize);

  // Normalize labels after deletion: decrement subsequent passage labels
  if (prevPassageLabel) {
    let expectedNext = incrementLabel(prevPassageLabel);
    const prefix = prevPassageLabel.split('.').slice(0, -1).join('.');
    const prefixWithDot = prefix ? prefix + '.' : '';
    const prevDepth = prevPassageLabel.split('.').length;

    tr.doc.descendants((child, childPos) => {
      if (child.type.name !== 'passage') return true;
      const childLabel = child.attrs.label as string;
      if (!childLabel) return true;

      // Only normalize passages with same prefix
      if (prefixWithDot && !childLabel.startsWith(prefixWithDot)) return true;
      if (childLabel.split('.').length !== prevDepth) return true;

      if (childLabel !== expectedNext) {
        tr.setNodeMarkup(childPos, null, {
          ...child.attrs,
          label: expectedNext,
        });
      }
      expectedNext = incrementLabel(expectedNext);
      return true;
    });
  }

  editor.view.dispatch(tr);
}
