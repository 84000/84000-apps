import type { JSONContent } from '@tiptap/core';
import { Fragment, Node as PMNode } from '@tiptap/pm/model';
import type { Schema } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import type { Doc } from 'yjs';
import type { BodyItemType } from '@eightyfourthousand/data-access';
import { CommandLog, type ContentChange } from './command-log';
import { PassageDocStore } from './doc-store';
import { EndNoteLinkUpkeep } from './end-note-link-upkeep';
import { HydrationWindows } from './hydration-windows';
import { incrementLabel } from './labels';
import type { PassageLoader } from './loader';
import type { PassageDoc } from './passage-doc';
import { Spine, type SpineSeed } from './spine';
import { withFreshSplitIdentities } from './split-identities';
import type { FocusTarget, PassageMeta, SpineRange } from './types';
import {
  EMPTY_PARAGRAPH,
  collapseLabelChanges,
  joinAtSeam,
} from './work-document-helpers';
import { WorkHistory } from './work-history';

/**
 * The label for a passage following one labelled `label`.
 *
 * An unlabelled passage is followed by another: abbreviation entries carry no
 * label, and numbering one after another would invent "1" for an entry.
 */
const labelAfter = (label: string) => (label ? incrementLabel(label) : '');

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
};

/** What a newly inserted passage is made of. */
export type InsertPassageInput = {
  /** Defaults to a fresh uuid. */
  uuid?: string;
  type: BodyItemType;
  /** Defaults to the label after the preceding passage's. */
  label?: string;
  toh?: PassageMeta['toh'];
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
  private listeners = new Set<() => void>();
  private hydration: HydrationWindows;
  private links: EndNoteLinkUpkeep;
  private history: WorkHistory;
  private unobserve: (() => void)[] = [];

  constructor(options: WorkDocumentOptions) {
    this.workUuid = options.workUuid;
    this.schema = options.schema;
    this.newUuid = options.newUuid ?? uuidv4;
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
      label: labelAfter(meta.label),
      toh: meta.toh,
    };

    const { entry, labelChanges } = this.spine.insert(newMeta, index + 1);
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

    const labelChanges = this.spine.remove([uuid], { deleted: true });
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
      label: passage.label ?? (previous ? labelAfter(previous.label) : '1'),
      toh: passage.toh,
    };

    const { entry, labelChanges } = this.spine.insert(meta, at);
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

    const content: ContentChange[] = targets.map((target) => ({
      uuid: target.uuid,
      before: this.store.ensure(target.uuid).toJSON(),
      after: null,
    }));
    const labelChanges = this.spine.remove(
      targets.map((t) => t.uuid),
      { deleted: true },
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
    let label = previous ? labelAfter(previous.label) : '1';
    const seeds: SpineSeed[] = replacements.map((passage) => {
      const seed: SpineSeed = {
        uuid: passage.uuid ?? this.newUuid(),
        type: passage.type,
        label: passage.label ?? label,
        toh: passage.toh,
      };
      label = labelAfter(seed.label);
      return seed;
    });

    const content: ContentChange[] = [
      ...targets.map((target) => ({
        uuid: target.uuid,
        before: this.store.ensure(target.uuid).toJSON(),
        after: null,
      })),
      ...seeds.map((seed, i) => ({
        uuid: seed.uuid,
        before: null,
        after: {
          type: 'doc',
          content: replacements[i].content?.length
            ? replacements[i].content
            : [EMPTY_PARAGRAPH],
        } as JSONContent,
      })),
    ];

    const labelChanges = this.spine.remove(
      targets.map((t) => t.uuid),
      { deleted: true },
    );
    content.push(...this.links.unlink(targets.map((t) => t.uuid)));
    const inserted = seeds.map((seed, i) => {
      const { entry, labelChanges: changes } = this.spine.insert(seed, at + i);
      labelChanges.push(...changes);
      this.store
        .ensure(entry.uuid)
        .replaceContent(content[targets.length + i].after as JSONContent);
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
    const result = this.spine.move(uuid, toIndex);
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

  /** Rename one passage, leaving the run around it alone. */
  setLabel(uuid: string, label: string): boolean {
    const meta = this.spine.meta(uuid);
    if (!meta || meta.label === label) return false;

    this.spine.setLabel(uuid, label);
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

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}
