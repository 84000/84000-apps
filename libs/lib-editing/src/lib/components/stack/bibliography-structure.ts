import {
  rowKindOf,
  type SpineEntry,
  type WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

/**
 * The structural edits a bibliography allows, over its work document.
 *
 * The order is the readers' order: each heading followed by its entries, then
 * the headings under it. An entry belongs to the heading before it, so these
 * keep every entry after a heading in a work that has one, and never leave a
 * heading's parent deleted.
 */

const isHeading = (entry: SpineEntry) => rowKindOf(entry.type) === 'heading';

/**
 * Where a heading's run of rows ends: the first heading after it that it
 * does not hold. A stored order can place some of what it holds later still.
 */
const blockEnd = (entries: SpineEntry[], index: number): number => {
  const held = new Set([entries[index].uuid]);
  let end = index + 1;
  for (; end < entries.length; end++) {
    const entry = entries[end];
    if (!isHeading(entry)) continue;
    if (!entry.parent || !held.has(entry.parent)) break;
    held.add(entry.uuid);
  }
  return end;
};

/** A row and every row under it, wherever they sit, by uuid. */
const heldBy = (entries: SpineEntry[], uuid: string): Set<string> => {
  const held = new Set([uuid]);
  // A child can come before its parent in a stored order: repeat until no
  // more join.
  for (let grew = true; grew; ) {
    grew = false;
    entries.forEach((entry) => {
      if (held.has(entry.uuid) || !entry.parent || !held.has(entry.parent)) {
        return;
      }
      held.add(entry.uuid);
      grew = true;
    });
  }
  return held;
};

/**
 * A row and everything it holds, as a run of the spine, or null when what it
 * holds does not follow it in one run, so it cannot be moved as one.
 */
const blockOf = (entries: SpineEntry[], index: number): string[] | null => {
  const held = heldBy(entries, entries[index].uuid);
  const run = entries.slice(index, index + held.size);
  return run.length === held.size && run.every((entry) => held.has(entry.uuid))
    ? run.map((entry) => entry.uuid)
    : null;
};

/** Where the rows a heading holds end, wherever they sit. */
const heldEnd = (entries: SpineEntry[], index: number): number => {
  const held = heldBy(entries, entries[index].uuid);
  let end = index + 1;
  entries.forEach((entry, i) => {
    if (held.has(entry.uuid)) end = Math.max(end, i + 1);
  });
  return end;
};

const locate = (work: WorkDocument, uuid: string) => {
  const entries = work.spine.entries();
  const index = entries.findIndex((entry) => entry.uuid === uuid);
  return index < 0 ? null : { entries, index, row: entries[index] };
};

/** Start a new entry after a row, under the same heading or the row itself. */
export const newBibliographyEntry = (
  work: WorkDocument,
  uuid: string,
): string | null => {
  const index = work.spine.indexOf(uuid);
  if (index < 0) return null;
  return work.insert({ type: 'bibliography' }, index + 1).uuid;
};

/**
 * Start a new heading after the row's heading: a sibling that follows it and
 * its rows, or with `nested` its last child. In a work with no heading yet it
 * goes first, so every entry has one.
 */
export const newBibliographyHeading = (
  work: WorkDocument,
  uuid: string,
  { nested = false }: { nested?: boolean } = {},
): string | null => {
  const found = locate(work, uuid);
  if (!found) return null;
  const { entries, row } = found;
  const heading = isHeading(row)
    ? row
    : entries.find((e) => e.uuid === row.parent);
  if (!heading) return work.insert({ type: 'bibliographyHeader' }, 0).uuid;

  const parent = nested ? heading.uuid : heading.parent;
  return work.insert(
    { type: 'bibliographyHeader', ...(parent ? { parent } : {}) },
    (nested ? heldEnd : blockEnd)(entries, heading.index),
  ).uuid;
};

/** Whether a row can be deleted: an entry always, a heading once empty. */
export const canDeleteBibliographyRow = (work: WorkDocument, uuid: string) => {
  const meta = work.spine.meta(uuid);
  if (!meta) return false;
  if (rowKindOf(meta.type) === 'entry') return true;
  return !work.spine.entries().some((entry) => entry.parent === uuid);
};

/** Delete a row, if it can be. */
export const deleteBibliographyRow = (work: WorkDocument, uuid: string) =>
  canDeleteBibliographyRow(work, uuid) && work.remove([uuid]);

/** Whether an entry can merge into the row before it, which must be an entry. */
export const canMergeBibliographyRow = (work: WorkDocument, uuid: string) => {
  const found = locate(work, uuid);
  if (!found || isHeading(found.row) || found.index === 0) return false;
  return !isHeading(found.entries[found.index - 1]);
};

/** The heading before this one under the same parent, ending where it starts. */
const previousSibling = (entries: SpineEntry[], index: number) => {
  const heading = entries[index];
  for (let i = index - 1; i >= 0; i--) {
    const entry = entries[i];
    if (!isHeading(entry) || entry.parent !== heading.parent) continue;
    return blockEnd(entries, i) === index ? entry : null;
  }
  return null;
};

/** Whether a heading can nest under the heading before it. */
export const canIndentBibliographyHeading = (
  work: WorkDocument,
  uuid: string,
) => {
  const found = locate(work, uuid);
  return (
    !!found &&
    isHeading(found.row) &&
    !!previousSibling(found.entries, found.index)
  );
};

/** Nest a heading, and what it holds, under the heading before it. */
export const indentBibliographyHeading = (work: WorkDocument, uuid: string) => {
  const found = locate(work, uuid);
  if (!found || !isHeading(found.row)) return false;
  const sibling = previousSibling(found.entries, found.index);
  if (!sibling) return false;
  return work.nest([uuid], { parents: [{ uuid, parent: sibling.uuid }] });
};

/** The heading a heading nests under, when it nests under one. */
const parentHeading = (entries: SpineEntry[], row: SpineEntry) =>
  row.parent
    ? entries.find((entry) => entry.uuid === row.parent && isHeading(entry))
    : undefined;

/** Whether a heading nests under another it can be taken out of. */
export const canOutdentBibliographyHeading = (
  work: WorkDocument,
  uuid: string,
) => {
  const found = locate(work, uuid);
  return (
    !!found && isHeading(found.row) && !!parentHeading(found.entries, found.row)
  );
};

/**
 * Take a heading, and what it holds, out of its parent: it follows its
 * parent's rows, as the parent's sibling.
 */
export const outdentBibliographyHeading = (
  work: WorkDocument,
  uuid: string,
) => {
  const found = locate(work, uuid);
  if (!found || !isHeading(found.row)) return false;
  const { entries, index, row } = found;
  const parent = parentHeading(entries, row);
  if (!parent) return false;
  const block = blockOf(entries, index);
  if (!block) return false;
  const end = blockEnd(entries, parent.index);
  return work.nest(block, {
    to: end > index ? end - block.length : end,
    parents: [{ uuid, ...(parent.parent ? { parent: parent.parent } : {}) }],
  });
};

/**
 * The headings a row can move under: any but the headings it holds itself.
 * An entry's own heading is included, so a menu lists every heading.
 */
export const bibliographyMoveTargets = (
  work: WorkDocument,
  uuid: string,
): SpineEntry[] => {
  const found = locate(work, uuid);
  if (!found) return [];
  const held = heldBy(found.entries, uuid);
  return found.entries.filter(
    (entry) => isHeading(entry) && !held.has(entry.uuid),
  );
};

/**
 * Move a row under a heading: an entry to the end of the heading's entries,
 * a heading, and what it holds, to the end of the heading's rows as its last
 * child. A heading moved under `null` goes to the end, at the top level.
 */
export const moveBibliographyRow = (
  work: WorkDocument,
  uuid: string,
  target: string | null,
) => {
  const found = locate(work, uuid);
  if (!found) return false;
  const { entries, index, row } = found;
  const targetIndex = target
    ? entries.findIndex((entry) => entry.uuid === target)
    : -1;
  if (target && (targetIndex < 0 || !isHeading(entries[targetIndex]))) {
    return false;
  }

  const block = blockOf(entries, index);
  if (!block || (target && heldBy(entries, uuid).has(target))) return false;
  // Where the run would start, counted before it leaves its place.
  const place = (at: number) => (at > index ? at - block.length : at);

  if (!isHeading(row)) {
    if (!target) return false;
    let end = targetIndex + 1;
    while (end < entries.length && !isHeading(entries[end])) end++;
    return work.nest(block, { to: place(end) });
  }

  return work.nest(block, {
    to: place(target ? blockEnd(entries, targetIndex) : entries.length),
    parents: [{ uuid, ...(target ? { parent: target } : {}) }],
  });
};
