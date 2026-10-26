import type { JSONContent } from '@tiptap/core';
import { Fragment, Node as PMNode } from '@tiptap/pm/model';
import type { Schema } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import type { Doc } from 'yjs';
import type { BodyItemType } from '@eightyfourthousand/data-access';
import { CommandLog, type ContentChange, type MoveChange } from './command-log';
import { PassageDocStore } from './doc-store';
import { EndNoteLinkUpkeep } from './end-note-link-upkeep';
import { HydrationWindows } from './hydration-windows';
import { incrementLabel } from './labels';
import type { PassageLoader } from './loader';
import type { PassageDoc } from './passage-doc';
import { Spine, type SpineSeed } from './spine';
import { withFreshSplitIdentities } from './split-identities';
import {
  BIBLIOGRAPHY_ROW_TYPES,
  type FocusTarget,
  type LabelChange,
  type ParentChange,
  type PassageMeta,
  type RowOutline,
  type SpineRange,
} from './types';
import {
  EMPTY_PARAGRAPH,
  collapseLabelChanges,
  joinAtSeam,
} from './work-document-helpers';
import { WorkHistory } from './work-history';

/**
 * Row types stored without labels. Production's abbreviations carry none,
 * the header included in effect: numbering a new one from its neighbour would
 * write `ab.1` or `1` to a row that never had a label. Bibliography rows have
 * no label at all.
 */
export const UNLABELLED_PASSAGE_TYPES: ReadonlySet<string> = new Set([
  'abbreviations',
  'abbreviationsHeader',
  ...BIBLIOGRAPHY_ROW_TYPES,
]);

/**
 * The label for a new passage of `type` following `previous`: empty for an
 * unlabelled type, otherwise numbered from the passage before, as it always
 * was, even from an empty label.
 */
const labelFor = (
  type: string,
  previous: { label: string } | null | undefined,
): string => {
  if (UNLABELLED_PASSAGE_TYPES.has(type)) return '';
  return previous ? incrementLabel(previous.label) : '1';
};

export type WorkDocumentOptions = {
  workUuid: string;
  /** See `PassageDocOptions.schema` — injected for the same reason. */
  schema: Schema;
  loader?: PassageLoader;
  /** An existing spine document, e.g. one restored from local storage. */
  spineDoc?: Doc;
  /** Passed through to every passage document. */
  textOrigins?: Set<unknown>;
  /** Overridable so tests can produce stable uuids. Defaults to uuid v4. */
  newUuid?: () => string;
  /**
   * Derives labels and nesting from the order after every change, for rows
   * numbered by position. Labels are then never renumbered or recorded: they
   * follow from the order, which undo restores.
   */
  outline?: RowOutline;
};

/** What a newly inserted passage is made of. */
export type InsertPassageInput = {
  /** Defaults to a fresh uuid. */
  uuid?: string;
  type: BodyItemType;
  /** Defaults to the label after the preceding passage's. */
  label?: string;
  toh?: PassageMeta['toh'];
  /** The row it nests under, such as a heading's parent heading. */
  parent?: string;
  content?: JSONContent[];
};

/**
 * A work, as the editor and the server-side write path both see it: a spine, a
 * windowed set of passage documents, and one command log over the two.
 *
 * The structural operations are the reason this class exists. Split, merge,
 * insert, delete and reorder each touch one or two passage documents *and* the
 * spine, and neither piece is meaningful without the other — a split that
 * updated two documents but not the order would lose a passage. Recording them
 * as commands is what makes them undoable as units.
 *
 * Nothing here touches a browser API. The editor mounts views over it; a route
 * handler drives it headlessly.
 */
export class WorkDocument {
  readonly workUuid: string;
  readonly spine: Spine;
  readonly store: PassageDocStore;
  readonly log = new CommandLog();
  /** Public because a caller building a slice to paste needs the same one. */
  readonly schema: Schema;

  private newUuid: () => string;
  private outline?: RowOutline;
  private listeners = new Set<() => void>();
  private hydration: HydrationWindows;
  private links: EndNoteLinkUpkeep;
  private history: WorkHistory;
  private unobserve: (() => void)[] = [];

  constructor(options: WorkDocumentOptions) {
    this.workUuid = options.workUuid;
    this.schema = options.schema;
    this.newUuid = options.newUuid ?? uuidv4;
    this.outline = options.outline;
    this.spine = new Spine(options.workUuid, options.spineDoc);
    this.store = new PassageDocStore({
      workUuid: options.workUuid,
      schema: options.schema,
      loader: options.loader,
      textOrigins: options.textOrigins,
    });
    this.hydration = new HydrationWindows({
      spine: this.spine,
      store: this.store,
      loader: options.loader,
      notify: () => this.notify(),
    });
    this.links = new EndNoteLinkUpkeep(this.spine, this.store);
    this.history = new WorkHistory({
      spine: this.spine,
      store: this.store,
      log: this.log,
      links: this.links,
      notify: () => this.notify(),
    });
    this.unobserve.push(
      this.spine.observe(this.links.renumberLinks),
      this.store.observe(this.links.unlinkLoadedPassages),
      this.store.observe(this.links.numberNewPassages),
    );
  }

  // ----------------------------------------------------------- hydration

  /**
   * Hydrate the documents for a range of the spine, plus the loader's buffer,
   * and release everything that fell outside it.
   *
   * This is the whole memory story in one call: what is in memory is what the
   * last call asked for, and a work of any length costs the same.
   *
   * `keep` names passages that must stay hydrated wherever the window happens
   * to be. A consumer that binds views to documents needs it: the editor keeps
   * a small live set around whatever has focus, and focus does not have to sit
   * inside the visible range — scrolling away from an open passage would
   * otherwise release the document out from under a mounted editor. Dirty
   * passages are already safe, so this is about the clean ones.
   */
  hydrateWindow(
    range: SpineRange,
    options: { keep?: Iterable<string>; key?: string } = {},
  ): Promise<PassageDoc[]> {
    return this.hydration.hydrate(range, options);
  }

  /** Forget a window, so what only it held can be released. */
  releaseWindow(key: string) {
    this.hydration.release(key);
  }

  /** Seed the spine from passage metadata, e.g. on a work's first visit. */
  seedSpine(passages: SpineSeed[]) {
    this.spine.seed(passages);
    this.notify();
  }

  // -------------------------------------------------------------- ops

  /**
   * Split a passage at `pos`, leaving the head in place and putting the tail
   * in a new passage immediately after it.
   *
   * `pos` is a ProseMirror position in the passage's own document — the
   * per-passage model has no work-wide coordinate space, which is the point.
   */
  split(uuid: string, pos: number): { uuid: string } | null {
    const index = this.spine.indexOf(uuid);
    const meta = this.spine.meta(uuid);
    if (index < 0 || !meta) return null;

    const doc = this.store.ensure(uuid);
    const node = doc.toNode();
    const head = this.fragmentToJSON(node.content.cut(0, pos));
    const tail = withFreshSplitIdentities(
      head,
      this.fragmentToJSON(node.content.cut(pos)),
    );
    const before = doc.toJSON();

    const newMeta: SpineSeed = {
      uuid: this.newUuid(),
      type: meta.type,
      // The tail of an unlabelled passage, such as toh145's introduction
      // header, is unlabelled too.
      label: meta.label ? labelFor(meta.type, meta) : '',
      toh: meta.toh,
    };

    const { entry, labelChanges } = this.spine.insert(
      newMeta,
      index + 1,
      this.mutation(),
    );
    doc.replaceContent(head);
    const tailDoc = this.store.ensure(entry.uuid);
    tailDoc.replaceContent(tail);

    this.history.record({
      kind: 'split',
      content: [
        { uuid, before, after: head },
        { uuid: entry.uuid, before: null, after: tail },
      ],
      inserted: [{ meta: entry, index: index + 1 }],
      removed: [],
      moved: [],
      labels: labelChanges,
      focusAfterUndo: { uuid, where: pos },
      focusAfterRedo: { uuid: entry.uuid, where: 'start' },
    });

    this.notify();
    return { uuid: entry.uuid };
  }

  /**
   * Merge a passage into the one before it.
   *
   * Returns the position in the surviving passage where the two joined, which
   * is where the caret belongs.
   */
  merge(uuid: string): { uuid: string; boundary: number } | null {
    const index = this.spine.indexOf(uuid);
    if (index <= 0) return null;
    const previousUuid = this.spine.uuidAt(index - 1);
    const meta = this.spine.meta(uuid);
    if (!previousUuid || !meta) return null;

    const previous = this.store.ensure(previousUuid);
    const current = this.store.ensure(uuid);
    const previousBefore = previous.toJSON();
    const currentBefore = current.toJSON();

    // Concatenating the two contents outright inserts a blank line whenever
    // either side of the seam is an empty paragraph — deleting an empty
    // passage would leave one at the end of the passage that absorbed it. Drop
    // it, and take the caret position from what the head actually contributes
    // rather than from its size beforehand, or the caret sits above the seam.
    const [head, tail] = joinAtSeam(
      previousBefore.content ?? [],
      currentBefore.content ?? [],
    );
    const boundary = this.contentSize(head);

    const merged: JSONContent = {
      type: 'doc',
      content:
        head.length || tail.length ? [...head, ...tail] : [EMPTY_PARAGRAPH],
    };

    const labelChanges = this.spine.remove([uuid], this.mutation(true));
    previous.replaceContent(merged);

    this.history.record({
      kind: 'merge',
      content: [
        { uuid: previousUuid, before: previousBefore, after: merged },
        { uuid, before: currentBefore, after: null },
      ],
      inserted: [],
      removed: [{ meta, index }],
      moved: [],
      labels: labelChanges,
      focusAfterUndo: { uuid, where: 'start' },
      focusAfterRedo: { uuid: previousUuid, where: boundary },
    });

    this.notify();
    return { uuid: previousUuid, boundary };
  }

  /**
   * Insert a new passage at a position in the spine.
   *
   * `alongWith` changes other passages in the same command, so one undo takes
   * back both, such as the link to a new endnote.
   */
  insert(
    passage: InsertPassageInput,
    index: number,
    options: { alongWith?: { uuid: string; after: JSONContent }[] } = {},
  ): { uuid: string } {
    const at = Math.max(0, Math.min(index, this.spine.length));
    const previous =
      at > 0 ? this.spine.meta(this.spine.uuidAt(at - 1) ?? '') : null;
    const meta: SpineSeed = {
      uuid: passage.uuid ?? this.newUuid(),
      type: passage.type,
      label: passage.label ?? labelFor(passage.type, previous),
      toh: passage.toh,
      ...(passage.parent ? { parent: passage.parent } : {}),
    };

    const { entry, labelChanges } = this.spine.insert(
      meta,
      at,
      this.mutation(),
    );
    const content = passage.content?.length
      ? passage.content
      : [EMPTY_PARAGRAPH];
    const doc = this.store.ensure(entry.uuid);
    doc.replaceContent({ type: 'doc', content });
    const others = (options.alongWith ?? []).map(({ uuid, after }) => {
      const other = this.store.ensure(uuid);
      const before = other.toJSON();
      other.replaceContent(after);
      return { uuid, before, after };
    });
    // The new content was made before the spine renumbered.
    this.links.numberLinks(others.map(({ uuid }) => uuid));

    this.history.record({
      kind: 'insert',
      content: [
        { uuid: entry.uuid, before: null, after: { type: 'doc', content } },
        ...others,
      ],
      inserted: [{ meta: entry, index: at }],
      removed: [],
      moved: [],
      labels: labelChanges,
      focusAfterRedo: { uuid: entry.uuid, where: 'start' },
    });

    this.notify();
    return { uuid: entry.uuid };
  }

  /** Delete whole passages. */
  remove(uuids: string[]): boolean {
    const targets = uuids
      .map((uuid) => ({
        uuid,
        index: this.spine.indexOf(uuid),
        meta: this.spine.meta(uuid),
      }))
      .filter((target) => target.index >= 0 && target.meta)
      .sort((a, b) => a.index - b.index);
    if (!targets.length) return false;

    const content = this.removedContent(targets.map((t) => t.uuid));
    const labelChanges = this.spine.remove(
      targets.map((t) => t.uuid),
      this.mutation(true),
    );
    content.push(...this.links.unlink(targets.map((t) => t.uuid)));

    this.history.record({
      kind: 'delete',
      content,
      inserted: [],
      removed: targets.map((target) => ({
        meta: target.meta as PassageMeta,
        index: target.index,
      })),
      moved: [],
      labels: labelChanges,
      focusAfterUndo: { uuid: targets[0].uuid, where: 'start' },
    });

    this.notify();
    return true;
  }

  /**
   * Replace a run of whole passages with new ones.
   *
   * What a paste over a passage selection is: the selected passages leave and
   * the pasted ones take their place, as one command, so a single undo puts
   * the originals back. With no replacements it is a plain delete of the run.
   */
  replacePassages(
    uuids: string[],
    replacements: InsertPassageInput[] = [],
  ): boolean {
    const targets = uuids
      .map((uuid) => ({ uuid, index: this.spine.indexOf(uuid) }))
      .filter((target) => target.index >= 0)
      .sort((a, b) => a.index - b.index);
    if (!targets.length) return false;

    const at = targets[0].index;
    const removed = targets.map((target) => ({
      meta: this.spine.meta(target.uuid) as PassageMeta,
      index: target.index,
    }));
    const previous =
      at > 0 ? this.spine.meta(this.spine.uuidAt(at - 1) ?? '') : null;

    // Seeded before the spine changes, so each new label follows the one
    // before it rather than the run that is about to leave.
    // The first continues the series it replaces, which the passage before
    // need not belong to, such as an unlabelled header.
    const replaced = removed[0].meta;
    const continues =
      !!replaced.label &&
      replaced.type === replacements[0]?.type &&
      !UNLABELLED_PASSAGE_TYPES.has(replaced.type);
    let before: { label: string } | null | undefined = previous;
    const seeds: SpineSeed[] = replacements.map((passage, i) => {
      const seed: SpineSeed = {
        uuid: passage.uuid ?? this.newUuid(),
        type: passage.type,
        label:
          passage.label ??
          (i === 0 && continues
            ? replaced.label
            : labelFor(passage.type, before)),
        toh: passage.toh,
      };
      before = seed;
      return seed;
    });

    const added: ContentChange[] = seeds.map((seed, i) => ({
      uuid: seed.uuid,
      before: null,
      after: {
        type: 'doc',
        content: replacements[i].content?.length
          ? replacements[i].content
          : [EMPTY_PARAGRAPH],
      },
    }));
    const content: ContentChange[] = [
      ...this.removedContent(targets.map((t) => t.uuid)),
      ...added,
    ];

    const labelChanges = this.spine.remove(
      targets.map((t) => t.uuid),
      this.mutation(true),
    );
    content.push(...this.links.unlink(targets.map((t) => t.uuid)));
    const inserted = seeds.map((seed, i) => {
      const { entry, labelChanges: changes } = this.spine.insert(
        seed,
        at + i,
        this.mutation(),
      );
      labelChanges.push(...changes);
      this.store
        .ensure(entry.uuid)
        .replaceContent(added[i].after as JSONContent);
      return { meta: entry, index: at + i };
    });

    this.history.record({
      kind: 'delete',
      content,
      inserted,
      removed,
      moved: [],
      labels: collapseLabelChanges(labelChanges),
      focusAfterUndo: { uuid: targets[0].uuid, where: 'start' },
      focusAfterRedo: seeds.length
        ? { uuid: seeds[0].uuid, where: 'start' }
        : undefined,
    });

    this.notify();
    return true;
  }

  /**
   * Take in passages the server rewrote, such as by a replace: each held one
   * is re-seeded, and the history that would write its old content back is
   * dropped. One with unsaved edits is left alone.
   */
  adoptServerContent(passages: { uuid: string; content: JSONContent[] }[]) {
    const adopted = new Set<string>();
    passages.forEach(({ uuid, content }) => {
      const doc = this.store.peek(uuid);
      if (!doc) return;
      if (doc.isDirty) {
        console.error(`not replacing passage ${uuid}: it has unsaved edits`);
        return;
      }
      doc.reseed(content);
      adopted.add(uuid);
    });
    if (adopted.size) this.log.forgetSnapshotsOf(adopted);
  }

  /** Move a passage to another position. */
  reorder(uuid: string, toIndex: number): boolean {
    const result = this.spine.move(uuid, toIndex, this.mutation());
    if (!result.moved || result.from === result.to) return result.moved;

    this.history.record({
      kind: 'reorder',
      content: [],
      inserted: [],
      removed: [],
      moved: [{ uuid, from: result.from, to: result.to }],
      labels: result.labelChanges,
      focusAfterUndo: { uuid, where: 'start' },
      focusAfterRedo: { uuid, where: 'start' },
    });

    this.notify();
    return true;
  }

  /**
   * Move a contiguous run of rows and change what rows nest under, as one
   * command.
   *
   * `to` is where the first row of the run ends up. Each parent is set as
   * given, an absent one being the top level.
   */
  nest(
    uuids: string[],
    {
      to,
      parents = [],
    }: { to?: number; parents?: { uuid: string; parent?: string }[] },
  ): boolean {
    const indices = uuids.map((uuid) => this.spine.indexOf(uuid));
    const from = indices[0];
    if (
      !uuids.length ||
      indices.some((index, i) => index < 0 || index !== from + i)
    ) {
      return false;
    }

    const moved: MoveChange[] = [];
    const labels: LabelChange[] = [];
    if (to !== undefined) {
      const target = Math.max(
        0,
        Math.min(to, this.spine.length - uuids.length),
      );
      // Moving down, the last row goes first, so each lands at its own offset
      // from the target without displacing the rows still to move.
      const order = target > from ? [...uuids].reverse() : uuids;
      order.forEach((uuid) => {
        const result = this.spine.move(
          uuid,
          target + uuids.indexOf(uuid),
          this.mutation(),
        );
        if (result.from === result.to) return;
        moved.push({ uuid, from: result.from, to: result.to });
        labels.push(...result.labelChanges);
      });
    }

    const parentChanges = parents.flatMap(
      ({ uuid, parent }): ParentChange[] => {
        const meta = this.spine.meta(uuid);
        if (!meta || meta.parent === parent) return [];
        return [{ uuid, from: meta.parent, to: parent }];
      },
    );
    this.spine.setParents(
      parentChanges.map(({ uuid, to: parent }) => ({ uuid, parent })),
    );
    if (!moved.length && !parentChanges.length) return false;

    this.history.record({
      kind: 'nest',
      content: [],
      inserted: [],
      removed: [],
      moved,
      labels: collapseLabelChanges(labels),
      parents: parentChanges,
      focusAfterUndo: { uuid: uuids[0], where: 'start' },
      focusAfterRedo: { uuid: uuids[0], where: 'start' },
    });

    this.notify();
    return true;
  }

  /** Rename one passage, leaving the run around it alone. */
  setLabel(uuid: string, label: string): boolean {
    const meta = this.spine.meta(uuid);
    if (!meta || meta.label === label) return false;

    this.spine.setLabel(uuid, label);
    // The label is saved with the passage.
    this.store.peek(uuid)?.markDirty();
    this.history.record({
      kind: 'label',
      content: [],
      inserted: [],
      removed: [],
      moved: [],
      labels: [{ uuid, from: meta.label, to: label }],
      focusAfterUndo: { uuid, where: 'start' },
      focusAfterRedo: { uuid, where: 'start' },
    });

    this.notify();
    return true;
  }

  // ------------------------------------------------------------- history

  /** Record that a passage's own undo manager took a text edit. */
  recordTextEdit(uuid: string) {
    this.log.push({ kind: 'text', uuid });
  }

  /**
   * Undo the last operation, whatever kind it was.
   *
   * A text entry delegates to that passage's `UndoManager`; a structural entry
   * is replayed backwards across every document and the spine it touched, in
   * one step. Returns where to put the caret, or null if there was nothing to
   * undo.
   */
  undo(): FocusTarget | null | undefined {
    return this.history.undo();
  }

  /** Redo the last undone operation. */
  redo(): FocusTarget | null | undefined {
    return this.history.redo();
  }

  // --------------------------------------------------------- observation

  /** Observe spine or structural changes. Returns an unsubscribe. */
  observe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Release every document. The spine survives — it is cheap to keep. */
  destroy() {
    this.unobserve.forEach((stop) => stop());
    this.hydration.clear();
    this.store.destroy();
    this.listeners.clear();
  }

  // ------------------------------------------------------------- private

  /**
   * What undo needs to put deleted passages back: the content of each one
   * held. One not held is left to load from its source when it returns, as
   * it would have before the delete; reading it here would make it empty.
   */
  private removedContent(uuids: string[]): ContentChange[] {
    return uuids.flatMap((uuid) => {
      const doc = this.store.peek(uuid);
      return doc ? [{ uuid, before: doc.toJSON(), after: null }] : [];
    });
  }

  /** The document size of a run of blocks, as a caret position. */
  private contentSize(content: JSONContent[]): number {
    if (!content.length) return 0;
    return PMNode.fromJSON(this.schema, { type: 'doc', content }).content.size;
  }

  private fragmentToJSON(fragment: Fragment): JSONContent {
    const content = fragment.toJSON() as JSONContent[] | null;
    return {
      type: 'doc',
      content: content?.length ? content : [EMPTY_PARAGRAPH],
    };
  }

  /** How a mutation treats labels: an outlined work derives them instead. */
  private mutation(deleted?: boolean) {
    return { renumber: !this.outline, ...(deleted ? { deleted } : {}) };
  }

  private notify() {
    if (this.outline) {
      this.spine.applyPlaces(this.outline(this.spine.entries()));
    }
    this.listeners.forEach((listener) => listener());
  }
}
