import { Editor } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { incrementLabel } from '@eightyfourthousand/lib-doc-model';
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

/** A passage node paired with its position, in document order. */
type PositionedPassage = {
  pos: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  node: any;
};

/** Every passage node in `doc`, in document order. */
function collectPassages(doc: ProseMirrorNode): PositionedPassage[] {
  const passages: PositionedPassage[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'passage') {
      passages.push({ pos, node });
    }
    return true;
  });
  return passages;
}

/**
 * Whether two passages are per-text variants of the same numbered slot: they
 * share a label and both name a Tohoku text. A passage with no `toh` applies to
 * every text in the work and so always stands alone in its slot — which is also
 * what keeps a transiently duplicated label from being mistaken for a variant
 * (a passage the client has just renumbered briefly shares a label with the
 * stale passage behind it).
 *
 * The single definition of slot membership: positioning and both renumber loops
 * go through it so they cannot drift apart.
 */
export function inSameSlot(
  label: unknown,
  toh: unknown,
  otherLabel: unknown,
  otherToh: unknown,
): boolean {
  return (
    label === otherLabel && (toh ?? null) !== null && (otherToh ?? null) !== null
  );
}

const isSameSlot = (a: PositionedPassage, b: PositionedPassage): boolean =>
  inSameSlot(
    a.node.attrs.label,
    a.node.attrs.toh,
    b.node.attrs.label,
    b.node.attrs.toh,
  );

/**
 * The run of passages around `index` that all belong to its slot, in document
 * order. A passage that shares no slot returns just itself.
 */
function slotMembers(
  passages: PositionedPassage[],
  index: number,
): PositionedPassage[] {
  let start = index;
  while (start > 0 && isSameSlot(passages[start - 1], passages[index])) {
    start--;
  }

  let end = index;
  while (
    end < passages.length - 1 &&
    isSameSlot(passages[end + 1], passages[index])
  ) {
    end++;
  }

  return passages.slice(start, end + 1);
}

/**
 * Insert a new empty endnote passage into the endnotes editor at the correct
 * position. Use `afterPassageUuid` to insert after a passage, or
 * `beforePassageUuid` to insert before one. With neither, the passage is
 * appended to the end of the doc.
 *
 * Increments labels and sort values of all subsequent passages **that are
 * loaded in this editor**. The endnotes panel is paginated (a window of
 * passages, not the whole series), so callers must guarantee the anchor
 * passage is loaded before calling — see `waitForPassageNode`. When an anchor
 * is named but absent, this returns `false` without touching the doc rather
 * than appending to the end of the loaded window: a misplaced insert leaves
 * the new note with a label that duplicates a note further down the series.
 *
 * An anchor may be one of several per-text variants sharing a label (see
 * `slotMembers`). The insert lands outside the whole slot — after its last
 * member, or before its first — never between two variants of one number, and
 * `sort` is advanced past the slot when needed so the new passage sorts outside
 * it too.
 *
 * Returns whether the passage was inserted.
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
): boolean {
  const { state } = editor;
  const { tr, schema } = state;
  const passageType = schema.nodes.passage;
  const paragraphType = schema.nodes.paragraph;

  if (!passageType || !paragraphType) {
    console.warn('Required node types not found in schema');
    return false;
  }

  // Find insertion position. An anchor that isn't in the loaded window is a
  // hard failure, not a reason to append — see the doc comment above.
  const anchorUuid = beforePassageUuid ?? afterPassageUuid;
  let insertPos = anchorUuid ? -1 : state.doc.content.size;
  let insertSort = sort;

  if (anchorUuid) {
    const passages = collectPassages(state.doc);
    const anchorIndex = passages.findIndex(
      (passage) => passage.node.attrs.uuid === anchorUuid,
    );

    if (anchorIndex !== -1) {
      const slot = slotMembers(passages, anchorIndex);

      if (anchorUuid === beforePassageUuid) {
        const first = slot[0];
        insertPos = first.pos;
        insertSort = Math.min(insertSort, first.node.attrs.sort ?? insertSort);
      } else {
        const last = slot[slot.length - 1];
        insertPos = last.pos + last.node.nodeSize;
        insertSort = Math.max(insertSort, (last.node.attrs.sort ?? 0) + 1);
      }
    }
  }

  if (insertPos === -1) {
    console.warn(
      `Endnote anchor passage ${anchorUuid} is not loaded in the endnotes editor; refusing to insert ${label} at the wrong position.`,
    );
    return false;
  }

  const newPassage = passageType.create(
    { label, sort: insertSort, uuid, type: 'endnotes' },
    paragraphType.create(),
  );

  tr.insert(insertPos, newPassage);

  // Increment labels and sorts of passages after the insertion point.
  // After the insert, the new passage occupies [insertPos, insertPos + newPassage.nodeSize).
  // Passages that were at insertPos in the original doc are now shifted by newPassage.nodeSize.
  const afterNewPos = insertPos + newPassage.nodeSize;
  const parts = label.split('.');
  const prefix = parts.slice(0, -1).join('.');
  const prefixWithDot = prefix ? prefix + '.' : '';
  const depth = parts.length;
  let expectedNext = incrementLabel(label);

  // A label is a slot, not a passage. A work covering several Tohoku texts can
  // hold per-text variants of one note — same label, distinguished by a
  // non-null `toh` — and every variant of a slot must land on the same new
  // number. Advancing per passage would fan one slot out across several
  // numbers and cascade through the rest of the sequence. A `toh`-less passage
  // always stands alone in its slot.
  let previousLabel: string | undefined;
  let previousToh: unknown = null;
  let previousAssignedLabel: string | undefined;

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
      const childToh = child.attrs.toh ?? null;
      const sameSlot =
        previousLabel !== undefined &&
        inSameSlot(childLabel, childToh, previousLabel, previousToh);
      const assignedLabel = sameSlot
        ? (previousAssignedLabel as string)
        : expectedNext;

      tr.setNodeMarkup(childPos, null, {
        ...child.attrs,
        label: assignedLabel,
        sort: (child.attrs.sort ?? 0) + 1,
      });

      previousLabel = childLabel;
      previousToh = childToh;
      previousAssignedLabel = assignedLabel;
      if (!sameSlot) {
        expectedNext = incrementLabel(expectedNext);
      }
    }
    return true;
  });

  editor.view.dispatch(tr);
  return true;
}

/**
 * Poll `predicate` until it holds. Resolves `true` on the first pass, or
 * `false` once the attempts are exhausted — callers treat the timeout as
 * "it never became ready" rather than waiting indefinitely.
 */
export async function waitFor(
  predicate: () => boolean,
  {
    timeoutMs = 5000,
    intervalMs = 50,
  }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<boolean> {
  const attempts = Math.max(1, Math.ceil(timeoutMs / intervalMs));

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (predicate()) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return predicate();
}

/**
 * Wait until `passageUuid` is a passage node in `editor`, e.g. while a
 * paginated panel loads the window that contains it.
 */
export function waitForPassageNode(
  editor: Editor,
  passageUuid: string,
  options?: { timeoutMs?: number; intervalMs?: number },
): Promise<boolean> {
  return waitFor(
    () => !editor.isDestroyed && Boolean(findPassageNode(editor, passageUuid)),
    options,
  );
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
    const parts = deletedLabel.split('.');
    const prefix = parts.slice(0, -1).join('.');
    const prefixWithDot = prefix ? prefix + '.' : '';
    const depth = parts.length;

    // Per-slot, not per-passage — see `insertEndnotePassage`. This also makes
    // deleting one per-text variant of a slot a no-op for the numbering: the
    // remaining variants keep the label, so nothing after them moves.
    let previousLabel: string | undefined;
    let previousToh: unknown = null;
    let previousAssignedLabel: string | undefined;

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

      const childToh = child.attrs.toh ?? null;
      const sameSlot =
        previousLabel !== undefined &&
        inSameSlot(childLabel, childToh, previousLabel, previousToh);
      const assignedLabel = sameSlot
        ? (previousAssignedLabel as string)
        : expectedNext;

      if (childLabel !== assignedLabel) {
        tr.setNodeMarkup(childPos, null, {
          ...child.attrs,
          label: assignedLabel,
        });
      }

      previousLabel = childLabel;
      previousToh = childToh;
      previousAssignedLabel = assignedLabel;
      if (!sameSlot) {
        expectedNext = incrementLabel(expectedNext);
      }
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

/**
 * Update the `label` attribute of loaded passage nodes to match `labelMap`.
 * Only nodes whose label actually differs are touched, so a no-op call
 * dispatches nothing.
 */
export function syncPassageLabels(
  editor: Editor,
  labelMap: Map<string, string>,
): void {
  const { tr } = editor.state;
  let changed = false;

  editor.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'passage' || !node.attrs.uuid) {
      return true;
    }

    const newLabel = labelMap.get(node.attrs.uuid);
    if (newLabel !== undefined && newLabel !== node.attrs.label) {
      tr.setNodeMarkup(pos, null, { ...node.attrs, label: newLabel });
      changed = true;
    }
    return true;
  });

  if (changed) {
    editor.view.dispatch(tr);
  }
}

/**
 * Apply labels the server assigned while renumbering a series to every editor
 * that could be displaying them: the passage nodes themselves and the labels
 * cached inside `endNoteLink` marks.
 *
 * A save only sends the passages the editor has loaded, but the server
 * renumbers the whole series — so links to notes outside the loaded window keep
 * showing their pre-save number until this runs. Callers must suppress dirty
 * tracking around it; these labels come from the server, and marking the
 * touched passages dirty would queue an immediate redundant save.
 */
export function applyRenumberedLabels(
  editors: Editor[],
  renumbered: { uuid: string; label: string }[],
): void {
  if (renumbered.length === 0) {
    return;
  }

  const labelMap = new Map(renumbered.map(({ uuid, label }) => [uuid, label]));
  for (const editor of editors) {
    if (editor.isDestroyed) {
      continue;
    }
    syncPassageLabels(editor, labelMap);
    syncEndnoteLinkLabels(editor, labelMap);
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
