import type { Editor, JSONContent } from '@tiptap/core';
import { Node as PMNode } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import { v4 as uuidv4 } from 'uuid';
import {
  incrementLabel,
  type PassageDoc,
} from '@eightyfourthousand/lib-doc-model';

import { endNoteLinkTransaction } from '../editor/extensions/EndNoteLink/EndNoteLinkMark';
import type { PassageStackController } from './PassageStackController';
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

type Entry = ReturnType<StackWork['work']['spine']['entries']>[number];

const hasToh = ({ toh }: Entry) =>
  Array.isArray(toh) ? toh.length > 0 : !!toh;

/** Whether two neighbours are per-Toh variants of one endnote. */
const variants = (a: Entry | undefined, b: Entry | undefined) =>
  !!a && !!b && a.label === b.label && hasToh(a) && hasToh(b);

/** The index of the first variant in an endnote's slot. */
const slotStart = ({ work }: StackWork, uuid: string) => {
  const entries = work.spine.entries();
  let index = work.spine.indexOf(uuid);
  while (variants(entries[index - 1], entries[index])) index--;
  return index;
};

/** The index of the last variant in an endnote's slot. */
const slotEnd = ({ work }: StackWork, uuid: string) => {
  const entries = work.spine.entries();
  let index = work.spine.indexOf(uuid);
  while (variants(entries[index], entries[index + 1])) index++;
  return index;
};

type Placement = { after: string } | { before: string } | { error: string };

const UNKNOWN: Placement = {
  error: 'Jump to the note just before this position, then add the new note.',
};

const UNREADABLE: Placement = {
  error: 'Could not read the passages before this position. Try again.',
};

/** How many unheld passages to hydrate at a time while searching back. */
const HYDRATE_CHUNK = 50;

/** A link found, none in what was searched, or the search could not tell. */
type Found = string | undefined | null;

/** The last link in passages the server served, preferring held copies. */
const lastLinkIn = (
  { work }: StackWork,
  passages: { uuid: string; content: JSONContent[] }[],
): Found => {
  const deleted = new Set(work.spine.removedSinceSave());
  for (let i = passages.length - 1; i >= 0; i--) {
    const { uuid, content } = passages[i];
    if (deleted.has(uuid)) continue;
    let node: PMNode;
    try {
      node =
        work.store.peek(uuid)?.toNode() ??
        PMNode.fromJSON(work.schema, { type: 'doc', content });
    } catch {
      return null;
    }
    const link = lastLinkBefore(node);
    if (link) return link;
  }
  return undefined;
};

/** The last link in a run's loaded entries, hydrating any it doesn't hold. */
const lastLinkInLoaded = async (
  { work }: StackWork,
  entries: Entry[],
): Promise<Found> => {
  for (let end = entries.length; end > 0; end -= HYDRATE_CHUNK) {
    const chunk = entries.slice(Math.max(0, end - HYDRATE_CHUNK), end);
    const missing = chunk
      .map((entry) => entry.uuid)
      .filter((uuid) => !work.store.has(uuid));
    let loaded: PassageDoc[] = [];
    try {
      if (missing.length) loaded = await work.store.hydrateMany(missing);
    } catch {
      return null;
    }
    const byUuid = new Map(loaded.map((doc) => [doc.uuid, doc]));
    for (let i = chunk.length - 1; i >= 0; i--) {
      const doc = work.store.peek(chunk[i].uuid) ?? byUuid.get(chunk[i].uuid);
      if (!doc) return null;
      const link = lastLinkBefore(doc.toNode());
      if (link) return link;
    }
  }
  return undefined;
};

/** The last link in the passages before a run's first saved one. */
const lastLinkInHead = async (
  stack: StackWork,
  view: PassageStackController,
  from: string,
): Promise<Found> => {
  let cursor: string | undefined = from;
  while (cursor) {
    const page = await view.readBeyond('before', cursor);
    if (!page) return null;
    const link = lastLinkIn(stack, page.passages);
    if (link !== undefined) return link;
    cursor = page.next;
  }
  return undefined;
};

/** The last link in the passages after a run's last saved one. */
const lastLinkInTail = async (
  stack: StackWork,
  view: PassageStackController,
  from: string,
): Promise<Found> => {
  let last: string | undefined;
  let cursor: string | undefined = from;
  while (cursor) {
    const page = await view.readBeyond('after', cursor);
    if (!page) return null;
    const link = lastLinkIn(stack, page.passages);
    if (link === null) return null;
    last = link ?? last;
    cursor = page.next;
  }
  return last;
};

const isSaved = (entry: Entry) => entry.sort !== undefined;

/**
 * Where a new endnote for the selection goes: next to the one whose link sits
 * nearest before it in reading order, which runs back through earlier tabs —
 * front matter links notes too.
 *
 * What the stack holds is read first, since it may hold unsaved links. The
 * rest is loaded as the search reaches it: passages in the spine through the
 * store, and those past an end of a run straight from the server. A read that
 * fails leaves the nearest link unknown, and guessing would give the note a
 * number another note already has.
 */
const placementFor = async (
  stack: StackWork,
  state: EditorState,
  passageUuid: string,
): Promise<Placement> => {
  const { work } = stack;
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
  if (index < 0) return UNKNOWN;

  // Each tab's run, nearest first. The spine holds runs, not the work between
  // them, so a run may be missing passages past either end.
  for (let at = index; at >= 0; ) {
    const { tab } = entries[at];
    let start = at;
    while (start > 0 && entries[start - 1].tab === tab) start--;
    let stop = at + 1;
    while (stop < entries.length && entries[stop].tab === tab) stop++;
    const run = entries.slice(start, stop);
    const own = at === index;
    const view = stack.controllerFor(tab);

    const searches: (() => Promise<Found>)[] = [];
    if (!own && view?.hasMorePassages()) {
      const last = run.filter(isSaved).at(-1);
      searches.push(async () =>
        last ? lastLinkInTail(stack, view, last.uuid) : null,
      );
    }
    searches.push(() =>
      lastLinkInLoaded(stack, own ? entries.slice(start, index) : run),
    );
    if (view?.hasEarlierPassages()) {
      const first = run.find(isSaved);
      searches.push(async () =>
        first ? lastLinkInHead(stack, view, first.uuid) : null,
      );
    }
    for (const search of searches) {
      const found = await search();
      if (found === null) return UNREADABLE;
      if (found) return { after: found };
    }
    at = start - 1;
  }

  // No link before it in the work: the first note, if the notes the stack
  // holds start at the true first one.
  const firstNote = entries.find(
    (entry) => entry.tab === ENDNOTES_TAB && entry.type === 'endnotes',
  );
  if (firstNote && firstNote.label !== 'n.1') return UNKNOWN;
  if (!firstNote) return { error: 'Open the Notes panel to add an endnote.' };
  return { before: firstNote.uuid };
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
  const placement = await placementFor(stack, initial, passageUuid);
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

  const index =
    'after' in placement
      ? slotEnd(stack, anchor) + 1
      : slotStart(stack, anchor);
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
