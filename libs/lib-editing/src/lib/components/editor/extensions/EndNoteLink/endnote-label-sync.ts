import { Editor } from '@tiptap/core';
import type { EndNoteLinkNote } from './endnote-links';

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
