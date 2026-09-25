import type { Editor } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import { incrementLabel } from '@eightyfourthousand/lib-doc-model';

import { endNoteLinkTransaction } from '../editor/extensions/EndNoteLink/EndNoteLinkMark';
import type { StackWork } from './StackWorkProvider';

const ENDNOTES_TAB = 'endnotes';

type Notes = { endNote?: string }[];

/** The endnotes a link mark in `node`'s marks points at, if it has one. */
const notesOf = (node: PMNode | null | undefined): string[] =>
  (
    (node?.marks.find((mark) => mark.type.name === 'endNoteLink')?.attrs
      .notes ?? []) as Notes
  )
    .map((note) => note.endNote)
    .filter((uuid): uuid is string => !!uuid);

/** The last endnote linked before `pos` in a document. */
const lastLinkBefore = (doc: PMNode, pos = doc.content.size) => {
  let last: string | undefined;
  doc.descendants((node, at) => {
    if (at >= pos) return false;
    last = notesOf(node).at(-1) ?? last;
    return true;
  });
  return last;
};

type Placement = { after: string } | { before: string } | { error: string };

/**
 * Where a new endnote for the selection goes: next to the one whose link sits
 * nearest before it.
 *
 * Earlier passages are searched while the stack holds them. Past one it
 * doesn't hold, the nearest link is unknown, and guessing would give the note
 * a number another note already has.
 */
const placementFor = (
  stack: StackWork,
  editor: Editor,
  passageUuid: string,
): Placement => {
  const { work } = stack;
  const { state } = editor;
  const { from, to } = state.selection;

  // A link already ending at the selection's end: the new note follows its
  // last note. One running past it is split, and the new note comes first.
  const atEnd = notesOf(state.doc.nodeAt(to - 1));
  if (atEnd.length) {
    const continues = notesOf(state.doc.nodeAt(to)).length > 0;
    return continues ? { before: atEnd[0] } : { after: atEnd.at(-1) as string };
  }

  const here = lastLinkBefore(state.doc, from);
  if (here) return { after: here };

  const entries = work.spine.entries();
  const index = entries.findIndex((entry) => entry.uuid === passageUuid);
  const tab = entries[index]?.tab;
  for (let i = index - 1; i >= 0 && entries[i].tab === tab; i--) {
    const doc = work.store.peek(entries[i].uuid);
    if (!doc) {
      return {
        error:
          'Jump to the note just before this position, then add the new note.',
      };
    }
    const link = lastLinkBefore(doc.toNode());
    if (link) return { after: link };
  }

  // No link before it in the section: the first note, if the notes the stack
  // holds start at the true first one.
  const first = entries.find(
    (entry) => entry.tab === ENDNOTES_TAB && entry.type === 'endnotes',
  );
  if (first && first.label !== 'n.1') {
    return {
      error:
        'Jump to the note just before this position, then add the new note.',
    };
  }
  if (!first) return { error: 'Open the Notes panel to add an endnote.' };
  return { before: first.uuid };
};

/**
 * Create an endnote for the selection in a stack passage's editor, and link
 * the selection to it.
 *
 * Both are one command in the work's log, so one undo takes back the link and
 * the endnote together.
 */
export const createStackEndnote = async ({
  stack,
  editor,
}: {
  stack: StackWork;
  editor: Editor;
}): Promise<{ uuid: string; label: string } | { error: string }> => {
  const { work } = stack;
  const endnotes = stack.controllerFor(ENDNOTES_TAB);
  const passageUuid = editor.view.dom.closest<HTMLElement>(
    '[data-stack-passage]',
  )?.dataset['stackPassage'];
  if (!endnotes || !passageUuid) {
    return { error: 'Open the Notes panel to add an endnote.' };
  }

  // Read before any await: the editor's selection can move meanwhile.
  const initial = editor.state;
  const placement = placementFor(stack, editor, passageUuid);
  if ('error' in placement) return placement;

  const anchor = 'after' in placement ? placement.after : placement.before;
  if (
    work.spine.indexOf(anchor) < 0 &&
    !(await endnotes.revealPassage(anchor))
  ) {
    return {
      error: 'Could not load the notes around this position. Try again.',
    };
  }
  const anchorMeta = work.spine.meta(anchor);
  const doc = work.store.peek(passageUuid);
  if (!anchorMeta || !doc) {
    return {
      error: 'Could not load the notes around this position. Try again.',
    };
  }

  const uuid = uuidv4();
  const label =
    'after' in placement ? incrementLabel(anchorMeta.label) : anchorMeta.label;

  // Linked from the state the placement was read from, unless the passage
  // changed during the await.
  if (!editor.state.doc.eq(initial.doc)) {
    return { error: 'The passage changed. Try again.' };
  }
  const linked = endNoteLinkTransaction(initial, uuid, label);
  if (!linked) return { error: 'This passage can’t hold an endnote.' };

  const index = work.spine.indexOf(anchor) + ('after' in placement ? 1 : 0);
  work.insert({ uuid, type: 'endnotes', label }, index, {
    alongWith: [{ uuid: passageUuid, after: linked.doc.toJSON() }],
  });
  return { uuid, label };
};

/**
 * Delete an endnote the stack may not be showing, with its links.
 *
 * The delete takes the links out of every passage the stack holds, as one
 * command; the save deletes the rest.
 */
export const deleteStackEndnote = async ({
  stack,
  endNote,
}: {
  stack: StackWork;
  endNote: string;
}): Promise<boolean> => {
  const endnotes = stack.controllerFor(ENDNOTES_TAB);
  if (!endnotes) return false;
  if (
    stack.work.spine.indexOf(endNote) < 0 &&
    !(await endnotes.revealPassage(endNote))
  ) {
    return false;
  }
  return endnotes.removePassage(endNote);
};
