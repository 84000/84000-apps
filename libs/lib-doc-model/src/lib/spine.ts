import { Array as YArray, Doc, Map as YMap, transact } from 'yjs';
import {
  panelAndTabForContentType,
  type BodyItemType,
} from '@eightyfourthousand/data-access';
import { renumberLabelsFrom } from './labels';
import type { LabelChange, PassageMeta, SpineEntry, SpineRange } from './types';

/**
 * Whether a mutation should renumber the labels it disturbs.
 *
 * Ordinary edits do. Command-log replay does not: it restores the exact labels
 * the original operation produced, and letting the spine renumber underneath
 * that would compute them a second time from a different starting state.
 */
export type MutateOptions = { renumber?: boolean };

/**
 * What a caller supplies for a new passage.
 *
 * Placement is not part of it: panel and tab are derived from the type by
 * `panelAndTabForContentType`, so there is no way to seed a passage into a tab
 * its type does not belong to.
 */
export type SpineSeed = Omit<PassageMeta, 'panel' | 'tab'>;

/** Yjs key for the ordered passage uuids. */
const ORDER_KEY = 'order';
/** Yjs key for the uuid → metadata map. */
const METAS_KEY = 'metas';

/** Transaction origin for every write this class makes. */
export const SPINE_ORIGIN = 'spine';

/**
 * The work-level document: which passages a work has, in what order, and
 * everything about them except their content.
 *
 * One spine is held for the whole session — it is small enough to, holding a
 * handful of short strings per passage rather than a document. That is the
 * point of the split: the spine answers "what is passage 4,812 called and
 * where does it sit" without hydrating anything, so ordering, labelling and
 * navigation stay O(1) in the size of the work's text.
 *
 * The order lives in a `Y.Array` so concurrent inserts from two editors
 * interleave rather than clobber; the metadata lives in a `Y.Map` of `Y.Map`s
 * so two editors relabelling different passages never conflict.
 */
export class Spine {
  readonly workUuid: string;
  readonly doc: Doc;

  private order: YArray<string>;
  private metas: YMap<YMap<unknown>>;

  constructor(workUuid: string, doc: Doc = new Doc()) {
    this.workUuid = workUuid;
    this.doc = doc;
    this.order = doc.getArray<string>(ORDER_KEY);
    this.metas = doc.getMap<YMap<unknown>>(METAS_KEY);
  }

  /**
   * Replace the spine's contents with `passages`.
   *
   * Used when seeding a work from the server for the first time. It is a
   * single transaction so observers see one change, not one per passage.
   */
  seed(passages: SpineSeed[]) {
    transact(
      this.doc,
      () => {
        this.order.delete(0, this.order.length);
        [...this.metas.keys()].forEach((key) => this.metas.delete(key));
        passages.forEach((passage) => this.appendUnsafe(passage));
      },
      SPINE_ORIGIN,
    );
  }

  // ------------------------------------------------------------- reading

  /** Number of passages in the work. */
  get length() {
    return this.order.length;
  }

  /** Passage uuids in order. */
  uuids(): string[] {
    return this.order.toArray();
  }

  /** Position of a passage, or -1 if the spine does not have it. */
  indexOf(uuid: string): number {
    return this.order.toArray().indexOf(uuid);
  }

  /** The uuid at a position, or undefined when out of range. */
  uuidAt(index: number): string | undefined {
    if (index < 0 || index >= this.order.length) return undefined;
    return this.order.get(index);
  }

  /** Metadata for one passage, or null when the spine does not have it. */
  meta(uuid: string): PassageMeta | null {
    const entry = this.metas.get(uuid);
    if (!entry) return null;
    return {
      uuid,
      label: (entry.get('label') as string) ?? '',
      type: (entry.get('type') as BodyItemType) ?? 'unknown',
      panel: (entry.get('panel') as string) ?? 'main',
      tab: (entry.get('tab') as string) ?? 'translation',
      toh: entry.get('toh') as PassageMeta['toh'],
    };
  }

  /** Every passage in order, with its position. */
  entries(): SpineEntry[] {
    return this.order.toArray().flatMap((uuid, index) => {
      const meta = this.meta(uuid);
      return meta ? [{ ...meta, index }] : [];
    });
  }

  /** The passages in a half-open range of positions, clamped to the spine. */
  slice(range: SpineRange): SpineEntry[] {
    const start = Math.max(0, Math.min(range.start, this.order.length));
    const end = Math.max(start, Math.min(range.end, this.order.length));
    const uuids = this.order.slice(start, end);
    return uuids.flatMap((uuid, offset) => {
      const meta = this.meta(uuid);
      return meta ? [{ ...meta, index: start + offset }] : [];
    });
  }

  /**
   * A window of `radius` passages either side of `index`, clamped to the
   * spine. This is the shape a virtualized view asks for.
   */
  window(index: number, radius: number): SpineRange {
    const start = Math.max(0, index - radius);
    const end = Math.min(this.order.length, index + radius + 1);
    return { start, end };
  }

  /**
   * The passages shown in one tab, in order — everything that tab renders.
   *
   * This is the grouping the UI actually draws, and the one worth asking the
   * spine for. Section headers come with their tab, because
   * `panelAndTabForContentType` folds `endnotesHeader` into `endnotes`.
   */
  tab(tab: string): SpineEntry[] {
    return this.entries().filter((entry) => entry.tab === tab);
  }

  /** The passages shown in one panel — `'main'` or `'right'`. */
  panel(panel: string): SpineEntry[] {
    return this.entries().filter((entry) => entry.panel === panel);
  }

  /**
   * The passages of one type, in order.
   *
   * Narrower than `tab`: a type excludes its section header, where the tab
   * includes it. The reader fetches by type (`getTranslationBlocks({ type })`),
   * so the spine answers that question too.
   */
  ofType(type: BodyItemType): SpineEntry[] {
    return this.entries().filter((entry) => entry.type === type);
  }

  /**
   * The `sort` value a passage's materialized row should carry.
   *
   * The spine's order is authoritative, so `sort` is derived from position
   * rather than stored — nothing can drift out of step with the order it is
   * meant to describe.
   */
  sortOf(uuid: string): number {
    return this.indexOf(uuid);
  }

  // ------------------------------------------------------------- writing

  /**
   * Insert a passage at `index`, renumbering the labels below it.
   *
   * Returns the entry as inserted. Out-of-range indices are clamped, so
   * `insert(meta, spine.length)` appends.
   */
  insert(
    passage: SpineSeed,
    index: number,
    options: MutateOptions = {},
  ): { entry: SpineEntry; labelChanges: LabelChange[] } {
    const at = Math.max(0, Math.min(index, this.order.length));
    let labelChanges: LabelChange[] = [];
    transact(
      this.doc,
      () => {
        this.order.insert(at, [passage.uuid]);
        this.metas.set(passage.uuid, this.metaMap(passage));
        // No anchor label: the caller chose the new passage's own label.
        if (options.renumber !== false) labelChanges = this.renumberRun(at);
      },
      SPINE_ORIGIN,
    );
    return {
      entry: { ...(this.meta(passage.uuid) as PassageMeta), index: at },
      labelChanges,
    };
  }

  /**
   * Remove passages, renumbering from the position the first removal left.
   *
   * Takes a set rather than one uuid because a cross-passage delete removes a
   * contiguous run, and doing that as one transaction keeps the intermediate
   * states — where the order and the metadata disagree — off the wire.
   */
  remove(uuids: string[], options: MutateOptions = {}): LabelChange[] {
    const targets = new Set(uuids);
    if (!targets.size) return [];
    let labelChanges: LabelChange[] = [];
    transact(
      this.doc,
      () => {
        const current = this.order.toArray();
        const firstIndex = current.findIndex((uuid) => targets.has(uuid));
        if (firstIndex < 0) return;

        const anchorIndex = Math.max(0, firstIndex - 1);
        const anchorLabel = this.meta(current[anchorIndex])?.label;

        // Walk backwards so each deletion's index stays valid.
        for (let i = current.length - 1; i >= 0; i--) {
          if (!targets.has(current[i])) continue;
          this.order.delete(i, 1);
          this.metas.delete(current[i]);
        }
        if (options.renumber !== false) {
          labelChanges = this.renumberRun(anchorIndex, anchorLabel);
        }
      },
      SPINE_ORIGIN,
    );
    return labelChanges;
  }

  /**
   * Move a passage to a new position, renumbering both the run it left and
   * the run it joined.
   *
   * `Y.Array` has no move primitive, so this is a delete plus an insert. Two
   * editors reordering the same passage concurrently therefore end with it in
   * one of the two places rather than duplicated — but a passage moved by one
   * editor while another edits it keeps its document either way, because the
   * document is not stored here.
   */
  move(
    uuid: string,
    toIndex: number,
    options: MutateOptions = {},
  ): { moved: boolean; from: number; to: number; labelChanges: LabelChange[] } {
    const from = this.indexOf(uuid);
    if (from < 0) return { moved: false, from: -1, to: -1, labelChanges: [] };
    const to = Math.max(0, Math.min(toIndex, this.order.length - 1));
    if (from === to) return { moved: true, from, to, labelChanges: [] };

    const anchorIndex = Math.min(from, to);
    const anchorLabel = this.meta(this.order.get(anchorIndex))?.label;

    let labelChanges: LabelChange[] = [];
    transact(
      this.doc,
      () => {
        this.order.delete(from, 1);
        this.order.insert(to, [uuid]);
        if (options.renumber !== false) {
          labelChanges = this.renumberRun(anchorIndex, anchorLabel);
        }
      },
      SPINE_ORIGIN,
    );
    return { moved: true, from, to, labelChanges };
  }

  /** Set one passage's label, leaving the rest of the run alone. */
  setLabel(uuid: string, label: string) {
    const entry = this.metas.get(uuid);
    if (!entry) return;
    transact(this.doc, () => entry.set('label', label), SPINE_ORIGIN);
  }

  /** Set one passage's type, re-deriving where it is surfaced. */
  setType(uuid: string, type: BodyItemType) {
    const entry = this.metas.get(uuid);
    if (!entry) return;
    const { panel, tab } = panelAndTabForContentType(type);
    transact(
      this.doc,
      () => {
        entry.set('type', type);
        entry.set('panel', panel);
        entry.set('tab', tab);
      },
      SPINE_ORIGIN,
    );
  }

  /**
   * Renumber the labels following `anchorIndex`.
   *
   * This is the whole of what `normalizeLabelsAfter` used to do by walking the
   * editor document: read the labels, compute the run, write back the ones
   * that moved. No passage document is opened.
   */
  renumberFrom(anchorIndex: number): LabelChange[] {
    const uuids = this.order.toArray();
    const labels = uuids.map((uuid) => this.meta(uuid)?.label ?? '');
    const changes = renumberLabelsFrom(labels, anchorIndex);
    if (!changes.size) return [];

    const applied: LabelChange[] = [];
    transact(
      this.doc,
      () => {
        changes.forEach((label, index) => {
          const uuid = uuids[index];
          const entry = this.metas.get(uuid);
          if (!entry) return;
          applied.push({ uuid, from: labels[index], to: label });
          entry.set('label', label);
        });
      },
      SPINE_ORIGIN,
    );
    return applied;
  }

  /**
   * Renumber a run, first forcing the label at its anchor.
   *
   * A removal or a move can leave a *different* passage sitting at the anchor
   * position, carrying the label it had somewhere else — deleting the first
   * passage of a work promotes the second, which still reads "2".
   * `renumberLabelsFrom` never touches its own anchor, so without this the run
   * is renumbered consistently from a wrong starting point and the whole work
   * is off by one. The label a position holds survives a reshuffle of the
   * passages under it, so restoring it is what makes the rest fall into place.
   */
  private renumberRun(
    anchorIndex: number,
    anchorLabel?: string,
  ): LabelChange[] {
    const changes: LabelChange[] = [];
    const anchorUuid = this.order.get(anchorIndex);
    const current = anchorUuid ? this.meta(anchorUuid)?.label : undefined;

    if (
      anchorUuid &&
      anchorLabel &&
      current !== undefined &&
      current !== anchorLabel
    ) {
      changes.push({ uuid: anchorUuid, from: current, to: anchorLabel });
      this.metas.get(anchorUuid)?.set('label', anchorLabel);
    }
    return [...changes, ...this.renumberFrom(anchorIndex)];
  }

  /**
   * Set several labels at once, without renumbering.
   *
   * The command log's route back to a previous labelling: it holds the exact
   * before/after pairs the original renumber produced, so restoring them is a
   * write, not a recomputation.
   */
  applyLabels(changes: { uuid: string; label: string }[]) {
    if (!changes.length) return;
    transact(
      this.doc,
      () => {
        changes.forEach(({ uuid, label }) => {
          this.metas.get(uuid)?.set('label', label);
        });
      },
      SPINE_ORIGIN,
    );
  }

  // ------------------------------------------------------- observation

  /**
   * Observe any change to the order or the metadata.
   *
   * Returns an unsubscribe function; `deep` because the metadata is a map of
   * maps and a relabel changes only the inner one.
   */
  observe(listener: () => void): () => void {
    const handler = () => listener();
    this.order.observeDeep(handler);
    this.metas.observeDeep(handler);
    return () => {
      this.order.unobserveDeep(handler);
      this.metas.unobserveDeep(handler);
    };
  }

  // ------------------------------------------------------------ private

  /** Insert at the end without a transaction of its own. Callers wrap. */
  private appendUnsafe(passage: SpineSeed) {
    this.order.push([passage.uuid]);
    this.metas.set(passage.uuid, this.metaMap(passage));
  }

  private metaMap(passage: SpineSeed): YMap<unknown> {
    const { panel, tab } = panelAndTabForContentType(passage.type);
    const entry = new YMap<unknown>();
    entry.set('label', passage.label);
    entry.set('type', passage.type);
    entry.set('panel', panel);
    entry.set('tab', tab);
    if (passage.toh) entry.set('toh', passage.toh);
    return entry;
  }
}
