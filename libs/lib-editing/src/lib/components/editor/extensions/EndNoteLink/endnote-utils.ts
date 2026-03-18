import { Editor } from '@tiptap/core';
import { incrementLabel } from '../Passage/label';
import { findPassageNode } from '../../util';

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

// Re-export for convenience — canonical definition is in ../../util.ts
export { findPassageNode } from '../../util';

/**
 * Get the last passage node in the endnotes editor.
 * Returns { label, sort, uuid } or undefined if no passages exist.
 */
export function getLastEndnoteInEditor(
  editor: Editor,
): { label: string; sort: number; uuid: string } | undefined {
  const { doc } = editor.state;
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
 * Get the first endnotes-type passage node in the endnotes editor.
 * Skips endnotesHeader passages.
 * Returns { label, sort, uuid } or undefined if no passages exist.
 */
export function getFirstEndnoteInEditor(
  editor: Editor,
): { label: string; sort: number; uuid: string } | undefined {
  const { doc } = editor.state;
  let first: { label: string; sort: number; uuid: string } | undefined;

  doc.descendants((node) => {
    if (!first && node.type.name === 'passage' && node.attrs.type === 'endnotes') {
      first = {
        label: node.attrs.label || '',
        sort: node.attrs.sort ?? 0,
        uuid: node.attrs.uuid,
      };
      return false;
    }
    return true;
  });

  return first;
}

/**
 * Insert a new empty endnote passage into the endnotes editor at the correct
 * position. Use `afterPassageUuid` to insert after a passage, or
 * `beforePassageUuid` to insert before one. Falls back to end of doc.
 * Increments labels and sort values of all subsequent passages.
 */
export function insertEndnotePassage(
  editor: Editor,
  {
    label,
    sort,
    uuid,
    afterPassageUuid,
    beforePassageUuid,
  }: {
    label: string;
    sort: number;
    uuid: string;
    afterPassageUuid?: string;
    beforePassageUuid?: string;
  },
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

  // Find insertion position
  let insertPos = state.doc.content.size;
  if (beforePassageUuid) {
    state.doc.descendants((node, pos) => {
      if (
        node.type.name === 'passage' &&
        node.attrs.uuid === beforePassageUuid
      ) {
        insertPos = pos;
        return false;
      }
      return true;
    });
  } else if (afterPassageUuid) {
    state.doc.descendants((node, pos) => {
      if (
        node.type.name === 'passage' &&
        node.attrs.uuid === afterPassageUuid
      ) {
        insertPos = pos + node.nodeSize;
        return false;
      }
      return true;
    });
  }

  tr.insert(insertPos, newPassage);

  // Increment labels and sorts of passages after the insertion point.
  // After the insert, the new passage occupies [insertPos, insertPos + newPassage.nodeSize).
  // Passages that were at insertPos in the original doc are now shifted by newPassage.nodeSize.
  const afterNewPos = insertPos + newPassage.nodeSize;
  const prefix = label.split('.').slice(0, -1).join('.');
  const prefixWithDot = prefix ? prefix + '.' : '';
  const depth = label.split('.').length;
  let expectedNext = incrementLabel(label);

  tr.doc.descendants((child, childPos) => {
    if (childPos < afterNewPos) return true;
    if (child.type.name !== 'passage') return true;
    const childLabel = child.attrs.label as string;
    if (!childLabel) return true;
    if (prefixWithDot && !childLabel.startsWith(prefixWithDot)) return true;
    if (childLabel.split('.').length !== depth) return true;

    if (child.attrs.type === 'endnotesHeader') {
      // Only update sort, never change header labels
      tr.setNodeMarkup(childPos, null, {
        ...child.attrs,
        sort: (child.attrs.sort ?? 0) + 1,
      });
    } else {
      tr.setNodeMarkup(childPos, null, {
        ...child.attrs,
        label: expectedNext,
        sort: (child.attrs.sort ?? 0) + 1,
      });
      expectedNext = incrementLabel(expectedNext);
    }
    return true;
  });

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
  const found = findPassageNode(editor, passageUuid);
  if (!found) return;

  const { pos, node } = found;
  const { tr } = editor.state;

  // Capture the deleted passage's label before removing it — subsequent
  // passages should be renumbered starting from this label.
  const deletedLabel = node.attrs.label as string | undefined;

  // Delete the passage node
  tr.delete(pos, pos + node.nodeSize);

  // Normalize labels after deletion: passages that were after the deleted
  // node (now starting at `pos` in the updated doc) get renumbered.
  if (deletedLabel) {
    let expectedNext = deletedLabel;
    const prefix = deletedLabel.split('.').slice(0, -1).join('.');
    const prefixWithDot = prefix ? prefix + '.' : '';
    const depth = deletedLabel.split('.').length;

    tr.doc.descendants((child, childPos) => {
      // Only process passages at or after the deletion point
      if (childPos < pos) return true;
      if (child.type.name !== 'passage') return true;
      const childLabel = child.attrs.label as string;
      if (!childLabel) return true;

      // Only normalize passages with same prefix and depth
      if (prefixWithDot && !childLabel.startsWith(prefixWithDot)) return true;
      if (childLabel.split('.').length !== depth) return true;

      if (child.attrs.type === 'endnotesHeader') {
        // Never change header labels
        return true;
      }
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

/**
 * Build a map of endnote passage UUID → label from the endnotes editor.
 */
export function buildEndnoteLabelMap(
  endnotesEditor: Editor,
): Map<string, string> {
  const map = new Map<string, string>();
  endnotesEditor.state.doc.descendants((node) => {
    if (node.type.name === 'passage' && node.attrs.uuid && node.attrs.label) {
      map.set(node.attrs.uuid, node.attrs.label);
    }
    return true;
  });
  return map;
}

/**
 * Update the `label` field inside `endNoteLink` marks in an editor to match
 * the current labels in the endnotes editor. Call this after deleting/renumbering
 * endnote passages so the superscript numbers in the UI stay in sync.
 */
export function syncEndnoteLinkLabels(
  editor: Editor,
  labelMap: Map<string, string>,
): void {
  const { tr } = editor.state;
  let changed = false;

  editor.state.doc.descendants((node, pos) => {
    for (const mark of node.marks) {
      if (mark.type.name !== 'endNoteLink') continue;
      const notes: EndNoteLinkNote[] = mark.attrs.notes || [];
      let notesChanged = false;

      const updatedNotes = notes.map((note) => {
        const newLabel = labelMap.get(note.endNote);
        if (newLabel !== undefined && newLabel !== note.label) {
          notesChanged = true;
          return { ...note, label: newLabel };
        }
        return note;
      });

      if (notesChanged) {
        const from = pos;
        const to = pos + node.nodeSize;
        tr.removeMark(from, to, mark.type);
        tr.addMark(
          from,
          to,
          mark.type.create({ ...mark.attrs, notes: updatedNotes }),
        );
        changed = true;
      }
    }
    return true;
  });

  if (changed) {
    editor.view.dispatch(tr);
  }
}

/** Editor keys that can contain endNoteLink marks. */
const ENDNOTE_LINK_EDITOR_KEYS = ['front', 'translation'] as const;

/**
 * After deleting/renumbering endnote passages, sync the updated labels into
 * endNoteLink marks across all editors that may contain them (front + translation).
 */
export function syncEndnoteLinkLabelsAcrossEditors(
  endnotesEditor: Editor,
  getEditor: (key: string) => Editor | undefined,
): void {
  const labelMap = buildEndnoteLabelMap(endnotesEditor);
  for (const key of ENDNOTE_LINK_EDITOR_KEYS) {
    const ed = getEditor(key);
    if (ed) {
      syncEndnoteLinkLabels(ed, labelMap);
    }
  }
}
