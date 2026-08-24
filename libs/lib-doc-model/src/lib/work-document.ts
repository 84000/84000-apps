import type { JSONContent } from '@tiptap/core';
import type { Fragment, Schema } from '@tiptap/pm/model';
import { v4 as uuidv4 } from 'uuid';
import type { Doc } from 'yjs';
import type { BodyItemType } from '@eightyfourthousand/data-access';
import { CommandLog, type StructuralCommand } from './command-log';
import { PassageDocStore } from './doc-store';
import { incrementLabel } from './labels';
import type { PassageLoader } from './loader';
import type { PassageDoc } from './passage-doc';
import { Spine } from './spine';
import type {
  FocusTarget,
  LabelChange,
  PassageMeta,
  SpineRange,
} from './types';

const EMPTY_PARAGRAPH: JSONContent = { type: 'paragraph' };

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

  private schema: Schema;
  private loader?: PassageLoader;
  private newUuid: () => string;
  private listeners = new Set<() => void>();

  constructor(options: WorkDocumentOptions) {
    this.workUuid = options.workUuid;
    this.schema = options.schema;
    this.loader = options.loader;
    this.newUuid = options.newUuid ?? uuidv4;
    this.spine = new Spine(options.workUuid, options.spineDoc);
    this.store = new PassageDocStore({
      workUuid: options.workUuid,
      schema: options.schema,
      loader: options.loader,
      textOrigins: options.textOrigins,
    });
  }

  // ----------------------------------------------------------- hydration

  /**
   * Hydrate the documents for a range of the spine, plus the loader's buffer,
   * and release everything that fell outside it.
   *
   * This is the whole memory story in one call: what is in memory is what the
   * last call asked for, and a work of any length costs the same.
   */
  async hydrateWindow(range: SpineRange): Promise<PassageDoc[]> {
    const buffered = this.loader?.bufferedRange(range) ?? range;
    const uuids = this.spine.slice(buffered).map((entry) => entry.uuid);
    const docs = await this.store.hydrateMany(uuids);
    this.store.releaseOutside(uuids);
    this.notify();
    return docs;
  }

  /** Seed the spine from passage metadata, e.g. on a work's first visit. */
  seedSpine(passages: Omit<PassageMeta, 'matter'>[]) {
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
    const tail = this.fragmentToJSON(node.content.cut(pos));
    const before = doc.toJSON();

    const newMeta: Omit<PassageMeta, 'matter'> = {
      uuid: this.newUuid(),
      type: meta.type,
      label: incrementLabel(meta.label),
      toh: meta.toh,
    };

    const { entry, labelChanges } = this.spine.insert(newMeta, index + 1);
    doc.replaceContent(head);
    const tailDoc = this.store.ensure(entry.uuid);
    tailDoc.replaceContent(tail);

    this.record({
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
    const boundary = previous.toNode().content.size;

    const merged: JSONContent = {
      type: 'doc',
      content: [
        ...(previousBefore.content ?? []),
        ...(currentBefore.content ?? []),
      ],
    };

    const labelChanges = this.spine.remove([uuid]);
    previous.replaceContent(merged);

    this.record({
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

  /** Insert a new passage at a position in the spine. */
  insert(passage: InsertPassageInput, index: number): { uuid: string } {
    const at = Math.max(0, Math.min(index, this.spine.length));
    const previous =
      at > 0 ? this.spine.meta(this.spine.uuidAt(at - 1) ?? '') : null;
    const meta: Omit<PassageMeta, 'matter'> = {
      uuid: passage.uuid ?? this.newUuid(),
      type: passage.type,
      label: passage.label ?? (previous ? incrementLabel(previous.label) : '1'),
      toh: passage.toh,
    };

    const { entry, labelChanges } = this.spine.insert(meta, at);
    const content = passage.content?.length
      ? passage.content
      : [EMPTY_PARAGRAPH];
    const doc = this.store.ensure(entry.uuid);
    doc.replaceContent({ type: 'doc', content });

    this.record({
      kind: 'insert',
      content: [
        { uuid: entry.uuid, before: null, after: { type: 'doc', content } },
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

    const content = targets.map((target) => ({
      uuid: target.uuid,
      before: this.store.ensure(target.uuid).toJSON(),
      after: null,
    }));
    const labelChanges = this.spine.remove(targets.map((t) => t.uuid));

    this.record({
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
   * Delete a range that starts inside one passage and ends inside another.
   *
   * Three things at once: trim the tail off the first passage, trim the head
   * off the last, and drop everything between. Doing it as one command is what
   * makes a single undo put all of it back.
   */
  deleteRange(
    fromUuid: string,
    fromPos: number,
    toUuid: string,
    toPos: number,
  ): boolean {
    let [startUuid, startPos, endUuid, endPos] = [
      fromUuid,
      fromPos,
      toUuid,
      toPos,
    ];
    let startIndex = this.spine.indexOf(startUuid);
    let endIndex = this.spine.indexOf(endUuid);
    if (startIndex < 0 || endIndex < 0) return false;
    if (startIndex > endIndex) {
      [startUuid, endUuid] = [endUuid, startUuid];
      [startPos, endPos] = [endPos, startPos];
      [startIndex, endIndex] = [endIndex, startIndex];
    }
    if (startIndex === endIndex) return false;

    const middles = this.spine
      .slice({ start: startIndex + 1, end: endIndex })
      .map((entry) => ({ meta: entry as PassageMeta, index: entry.index }));

    const startDoc = this.store.ensure(startUuid);
    const endDoc = this.store.ensure(endUuid);
    const startBefore = startDoc.toJSON();
    const endBefore = endDoc.toJSON();
    const startAfter = this.fragmentToJSON(
      startDoc.toNode().content.cut(0, startPos),
    );
    const endAfter = this.fragmentToJSON(endDoc.toNode().content.cut(endPos));

    const content = [
      { uuid: startUuid, before: startBefore, after: startAfter },
      ...middles.map((middle) => ({
        uuid: middle.meta.uuid,
        before: this.store.ensure(middle.meta.uuid).toJSON(),
        after: null,
      })),
      { uuid: endUuid, before: endBefore, after: endAfter },
    ];

    const labelChanges = this.spine.remove(
      middles.map((middle) => middle.meta.uuid),
    );
    startDoc.replaceContent(startAfter);
    endDoc.replaceContent(endAfter);

    this.record({
      kind: 'delete',
      content,
      inserted: [],
      removed: middles,
      moved: [],
      labels: labelChanges,
      focusAfterUndo: { uuid: startUuid, where: startPos },
      focusAfterRedo: { uuid: startUuid, where: 'end' },
    });

    this.notify();
    return true;
  }

  /** Move a passage to another position. */
  reorder(uuid: string, toIndex: number): boolean {
    const result = this.spine.move(uuid, toIndex);
    if (!result.moved || result.from === result.to) return result.moved;

    this.record({
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
    while (this.log.depth) {
      const command = this.log.popUndo();
      if (!command) return null;

      if (command.kind !== 'text') {
        this.log.suppress(() => this.applyInverse(command));
        this.log.pushRedo(command);
        this.notify();
        return command.focusAfterUndo;
      }

      const doc = this.store.peek(command.uuid);
      if (doc?.undo()) {
        this.log.pushRedo(command);
        this.notify();
        return { uuid: command.uuid, where: 'end' };
      }
      // The passage was released, taking its text history with it. Drop the
      // entry and try the one before it rather than swallowing the undo.
    }
    return null;
  }

  /** Redo the last undone operation. */
  redo(): FocusTarget | null | undefined {
    while (this.log.redoDepth) {
      const command = this.log.popRedo();
      if (!command) return null;

      if (command.kind !== 'text') {
        this.log.suppress(() => this.applyForward(command));
        this.log.pushUndo(command);
        this.notify();
        return command.focusAfterRedo;
      }

      const doc = this.store.peek(command.uuid);
      if (doc?.redo()) {
        this.log.pushUndo(command);
        this.notify();
        return { uuid: command.uuid, where: 'end' };
      }
    }
    return null;
  }

  // --------------------------------------------------------- observation

  /** Observe spine or structural changes. Returns an unsubscribe. */
  observe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Release every document. The spine survives — it is cheap to keep. */
  destroy() {
    this.store.destroy();
    this.listeners.clear();
  }

  // ------------------------------------------------------------- private

  private record(command: StructuralCommand) {
    this.log.push(command);
  }

  /**
   * Replay a command in the direction it was originally applied.
   *
   * Order is load bearing: passages leave the spine before the surviving
   * passages take their merged content, and join it before theirs is written,
   * so no intermediate state has content without a position or the reverse.
   */
  private applyForward(command: StructuralCommand) {
    this.spine.remove(
      command.removed.map((change) => change.meta.uuid),
      { renumber: false },
    );
    [...command.inserted]
      .sort((a, b) => a.index - b.index)
      .forEach((change) =>
        this.spine.insert(change.meta, change.index, { renumber: false }),
      );
    command.moved.forEach((move) =>
      this.spine.move(move.uuid, move.to, { renumber: false }),
    );
    command.content.forEach((change) => {
      if (change.after === null) return;
      this.store.ensure(change.uuid).replaceContent(change.after);
    });
    this.applyLabels(command.labels, 'to');
  }

  /** Replay a command backwards. The mirror of `applyForward`. */
  private applyInverse(command: StructuralCommand) {
    this.spine.remove(
      command.inserted.map((change) => change.meta.uuid),
      { renumber: false },
    );
    [...command.removed]
      .sort((a, b) => a.index - b.index)
      .forEach((change) =>
        this.spine.insert(change.meta, change.index, { renumber: false }),
      );
    [...command.moved]
      .reverse()
      .forEach((move) =>
        this.spine.move(move.uuid, move.from, { renumber: false }),
      );
    command.content.forEach((change) => {
      if (change.before === null) return;
      this.store.ensure(change.uuid).replaceContent(change.before);
    });
    this.applyLabels(command.labels, 'from');
  }

  private applyLabels(changes: LabelChange[], side: 'from' | 'to') {
    this.spine.applyLabels(
      changes.map((change) => ({ uuid: change.uuid, label: change[side] })),
    );
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
