import { Editor, Extensions } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { getBookmarks } from '@eightyfourthousand/data-access';
import type {
  FocusTarget,
  PassageMeta,
  SpineRange,
  WorkDocument,
} from '@eightyfourthousand/lib-doc-model';
import type { PassageReference } from '../editor/extensions/Passage/PassageNode.ssr';

import { buildStackEditorExtensions } from './stack-extensions';
import { StackLiveEditors } from './stack-live-editors';
import { StackPassageSelectionModel } from './stack-passage-selection';
import { StackRowContent } from './stack-row-content';
import type {
  PassageExtras,
  StackFocusWhere,
  StackPassageSeed,
} from './types';

export type PassageStackControllerOptions = {
  work: WorkDocument;
  /** Character counts by passage uuid, for estimating unhydrated row heights. */
  charCounts?: Iterable<readonly [string, number]>;
  /**
   * Grows the spine as the reader approaches the end of it.
   *
   * Optional: a caller holding a complete spine already — the scale harness,
   * and tests — passes none, and the stack simply never asks for more.
   */
  spineFeed?: {
    hasMore: boolean;
    maybeExtend: (visibleEnd: number) => boolean;
    /** Characters of text in a passage, for estimating an unhydrated row. */
    contentLength?: (uuid: string) => number | undefined;
    /** Only a feed that can read backward supplies these. */
    hasMoreBefore?: boolean;
    maybeExtendBefore?: (visibleStart: number) => boolean;
    reveal?: (uuid: string) => Promise<number>;
  };
  /** Reader rather than studio: shows bookmarks, as `TranslationReader` does. */
  readOnly?: boolean;
  /**
   * Names this view's hydration window on the work.
   *
   * Views over one work scroll independently, and the work hydrates the union
   * of their windows — so two controllers sharing a key would release each
   * other's documents, which is the whole thing the key prevents.
   */
  windowKey?: string;
  /**
   * Draw only this tab's passages.
   *
   * One work, one spine, one undo history — but a view per panel, because
   * that is what the editor draws. Omitted, the view is the whole spine.
   */
  tab?: string;
  /** Loaded passages' row data beyond their content, as the loader records it. */
  extras?: ReadonlyMap<string, PassageExtras>;
};

/**
 * The view half of the editor-per-passage stack.
 *
 * Everything about *what the work is* — the spine, the passage documents,
 * split/merge/delete, and the command log that undoes them — belongs to
 * `WorkDocument` and is not duplicated here. What is here is everything a
 * `WorkDocument` has no opinion about because it has no view: which passages
 * currently carry a live editor, where focus is, the static HTML shown for the
 * rest, row height estimates, and the DOM-level cross-passage selection.
 *
 * Two windows move independently and it matters that they are not confused.
 * The *hydration* window is scroll-driven: it follows the virtualized range so
 * a work of any length costs the same to hold. The *live editor* set is
 * focus-driven and small — the focused passage and its immediate neighbours —
 * so scrolling never mounts or destroys an editor, and a passage being edited
 * keeps its editor even after it scrolls out of sight.
 */
export class PassageStackController {
  readonly work: WorkDocument;

  private readonly content: StackRowContent;
  private readonly live: StackLiveEditors;
  private readonly selection: StackPassageSelectionModel;

  /**
   * The Tohoku text being read, when the work spans more than one.
   *
   * Undefined means "not scoped yet", which shows every row. Hiding all
   * scoped rows because nothing has named a toh is worse than doing nothing —
   * the same reason the annotation visibility rule settles on a default.
   */
  private activeToh?: string;

  private orderCache: string[] | null = null;
  private visibleRange: SpineRange = { start: 0, end: 0 };
  private hydrating = false;
  private hydrationQueued = false;

  private spineFeed?: PassageStackControllerOptions['spineFeed'];
  /**
   * Whether reaching index 0 should pull the previous page.
   *
   * Disarmed by a reveal: the list renders from the top for a frame before the
   * scroll lands, and paging upward then would prepend a hundred rows under a
   * reader who never asked to go up — moving the target out from under the
   * scroll that was about to happen.
   */
  private earlierArmed = true;
  /** In-flight reveals, so a remount does not fetch the same window twice. */
  private revealing = new Map<string, Promise<boolean>>();
  private readOnly: boolean;
  private readonly windowKey: string;
  private readonly tab?: string;
  private bookmarks = new Set<string>();

  private listeners = new Set<() => void>();
  private version = 0;
  private disposers: (() => void)[] = [];
  private extras?: ReadonlyMap<string, PassageExtras>;

  constructor(options: PassageStackControllerOptions) {
    this.work = options.work;
    this.spineFeed = options.spineFeed;
    this.readOnly = options.readOnly ?? false;
    this.tab = options.tab;
    this.extras = options.extras;
    this.windowKey = options.windowKey ?? options.tab ?? 'default';
    this.readBookmarks();
    this.content = new StackRowContent({
      work: this.work,
      spineFeed: options.spineFeed,
      charCounts: options.charCounts,
      bump: () => this.bump(),
    });
    this.live = new StackLiveEditors({
      work: this.work,
      getOrder: this.getOrder,
      hydrateOne: (uuid) => this.hydrateOne(uuid),
      bump: () => this.bump(),
    });
    this.selection = new StackPassageSelectionModel({
      work: this.work,
      getOrder: this.getOrder,
      getMeta: this.getMeta,
      focusPassage: (uuid, where) => this.focusPassage(uuid, where),
      blurEditors: () => this.live.blurEditors(),
      bump: () => this.bump(),
    });

    // Structural ops notify through the work; a spine change arriving from
    // another client notifies only through the spine. Both invalidate the
    // order the virtualizer is drawing.
    this.disposers.push(
      this.work.observe(() => {
        this.orderCache = null;
        this.bump();
      }),
      this.work.spine.observe(() => {
        this.orderCache = null;
        this.bump();
      }),
      this.work.store.observe(() => {
        this.content.reconcileWiring();
        this.bump();
      }),
    );
  }

  /**
   * Seed a work's spine and documents from rows, and return the char counts a
   * controller wants alongside it.
   *
   * Only for callers holding a whole work already — the sandbox, and tests.
   * The real path seeds the spine from `loadSpineMetas` and hydrates documents
   * a window at a time.
   */
  static seedWork(work: WorkDocument, seeds: StackPassageSeed[]) {
    work.seedSpine(seeds.map((seed) => seed.meta));
    seeds.forEach((seed) => work.store.create(seed.meta.uuid, seed.content));
    return new Map(seeds.map((seed) => [seed.meta.uuid, seed.charCount]));
  }

  // ---------------------------------------------------------------- spine

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  /**
   * The passage uuids in order.
   *
   * Cached because the virtualizer reads it every render and
   * `Spine.uuids()` materializes the whole `Y.Array` each call.
   */
  getOrder = () => {
    if (!this.orderCache) {
      const all = this.tab
        ? this.work.spine.tab(this.tab).map((entry) => entry.uuid)
        : this.work.spine.uuids();
      this.orderCache = all.filter((uuid) => this.showsForToh(uuid));
    }
    return this.orderCache;
  };

  /**
   * Whether a passage belongs to the toh being read.
   *
   * A work can span several Tohoku texts — toh145's spans four — and a
   * passage scoped to one of them has no business appearing under another:
   * toh145 and toh847 each carry their own endnote n.10. Most passages carry
   * no scope at all and belong to every reading of the work.
   *
   * This is a question about which rows exist, not about CSS. The annotation
   * rule hides scoped markup with `display: none`, which a virtualized row
   * cannot use: rows are absolutely positioned at measured offsets, so hiding
   * one leaves a hole the size of the passage.
   */
  private showsForToh = (uuid: string) => {
    if (!this.activeToh) return true;
    const toh = this.work.spine.meta(uuid)?.toh;
    return !toh || toh === this.activeToh;
  };

  /** Name the Tohoku text being read, which decides which rows are drawn. */
  setActiveToh = (toh?: string) => {
    if (this.activeToh === toh) return;
    this.activeToh = toh;
    this.orderCache = null;
    this.bump();
  };

  getActiveToh = () => this.activeToh;

  getMeta = (uuid: string): PassageMeta | null => this.work.spine.meta(uuid);

  /** The passages that refer to this one, such as those linking an endnote. */
  getReferences = (uuid: string): PassageReference[] =>
    this.extras?.get(uuid)?.references ?? [];

  /** A passage's Tibetan source for a Toh, when it is aligned to one. */
  getTibetan = (uuid: string, toh?: string): string =>
    (toh
      ? this.extras?.get(uuid)?.alignments?.[toh]?.tibetan
      : undefined
    )?.trim() ?? '';

  passageCount = () => this.work.spine.length;

  mountedCount = () => this.live.mountedCount();

  undoDepth = () => this.work.log.depth;

  /** Reader rather than studio, which decides how a link is followed. */
  isReadOnly = () => this.readOnly;

  /** The tab this view draws, which is also what names its panel. */
  getTab = () => this.tab;

  /** Whether a row shows the bookmark indicator. */
  showsBookmark = (uuid: string) => this.readOnly && this.bookmarks.has(uuid);

  /**
   * Re-read the bookmark store.
   *
   * Bookmarks live in local storage, so a change in another tab arrives as a
   * `storage` event and nothing else announces it.
   */
  refreshBookmarks = () => {
    const before = this.bookmarks;
    this.readBookmarks();
    const same =
      before.size === this.bookmarks.size &&
      [...before].every((uuid) => this.bookmarks.has(uuid));
    if (!same) this.bump();
  };

  private readBookmarks() {
    this.bookmarks = new Set(getBookmarks().map((bookmark) => bookmark.uuid));
  }

  /** Whether this passage's document is in memory and can be rendered. */
  isHydrated = (uuid: string) => this.work.store.has(uuid);

  /**
   * Whether a window load is in flight.
   *
   * A settled scroll needs this: between issuing the scroll and the content
   * landing the page is perfectly still, and stillness alone cannot tell
   * "finished" from "waiting on the network". Releasing the anchor during that
   * gap is what let a revealed row jump out of view when the last page
   * arrived.
   */
  isHydrating = () => this.hydrating;

  /**
   * The whole row's height, for the virtualizer's initial estimate.
   *
   * The same as the content's: the label hangs in the margin and the row has
   * no vertical padding, so nothing else contributes height. An estimate that
   * added chrome would exceed what the row then measures, and every unhydrated
   * row would visibly collapse the moment it was drawn.
   */
  estimateHeight = (uuid: string) => this.estimateContentHeight(uuid);

  /** Just the text column, for sizing a placeholder inside an existing row. */
  estimateContentHeight = (uuid: string) =>
    this.content.estimateContentHeight(uuid);

  /**
   * Whether the row's height is a real measure of *this* passage or the
   * generic fallback.
   */
  hasSizeFor = (uuid: string) => this.content.hasSizeFor(uuid);

  /**
   * Static HTML for a row that doesn't carry a live editor, or null when the
   * passage has not been hydrated.
   */
  getStaticHTML = (uuid: string): string | null =>
    this.content.getStaticHTML(uuid);

  // ------------------------------------------------------------ hydration

  /**
   * Tell the controller which rows the virtualizer is drawing.
   *
   * Hydration is widened by the loader's own buffer, so this is the visible
   * range rather than a padded one. Calls made while a load is in flight
   * collapse into a single follow-up, so a fast scroll issues two loads rather
   * than one per frame.
   */
  setVisibleRange = (range: SpineRange) => {
    if (
      range.start === this.visibleRange.start &&
      range.end === this.visibleRange.end
    ) {
      return;
    }
    this.visibleRange = range;
    // The spine covers only the pages fetched so far, so approaching either
    // end has to pull the next one before there is anything to hydrate.
    this.spineFeed?.maybeExtend(range.end);
    if (range.start > 0) this.earlierArmed = true;
    // Disarmed again by the page it starts: until the view re-anchors on the
    // row that used to be first, the range still reads as index 0 and would
    // ask for another.
    if (this.earlierArmed && this.spineFeed?.maybeExtendBefore?.(range.start)) {
      this.earlierArmed = false;
    }
    void this.runHydration();
  };

  /**
   * This view's range, as spine positions.
   *
   * Rows are indexed within the tab, hydration is indexed within the work.
   * A tab's passages are contiguous in the spine, so the ends are enough.
   */
  private spineRange(range: SpineRange): SpineRange {
    if (!this.tab) return range;
    const order = this.getOrder();
    const first = order[range.start];
    const last = order[Math.max(range.start, range.end - 1)];
    if (!first || !last) return { start: 0, end: 0 };

    const start = this.work.spine.indexOf(first);
    const end = this.work.spine.indexOf(last) + 1;
    return { start: Math.max(0, start), end: Math.max(start, end) };
  }

  /** Whether the work has passages before the ones the spine holds. */
  hasEarlierPassages = () => this.spineFeed?.hasMoreBefore ?? false;

  /** Whether the work has passages the spine has not loaded yet. */
  hasMorePassages = () => this.spineFeed?.hasMore ?? false;

  private async runHydration() {
    if (this.hydrating) {
      this.hydrationQueued = true;
      return;
    }
    this.hydrating = true;
    try {
      do {
        this.hydrationQueued = false;
        // Live editors are pinned: focus does not have to sit inside the
        // scrolled range, and releasing a document under a mounted editor
        // would leave it bound to a destroyed fragment.
        const docs = await this.work.hydrateWindow(
          this.spineRange(this.visibleRange),
          { keep: this.live.getLiveUuids(), key: this.windowKey },
        );
        docs.forEach((doc) => this.content.wire(doc));
      } while (this.hydrationQueued);
    } finally {
      this.hydrating = false;
    }
    this.bump();
  }

  /**
   * Scroll a passage into view, loading it into the spine if the window does
   * not hold it.
   *
   * What a deep link resolves to. The target is named, not positioned, so an
   * unknown one rebuilds the spine around itself rather than paging to it.
   * Resolves false when the work has no such passage.
   */
  revealPassage = (uuid: string): Promise<boolean> => {
    const existing = this.revealing.get(uuid);
    if (existing) return existing;

    const run = this.reveal(uuid).finally(() => this.revealing.delete(uuid));
    this.revealing.set(uuid, run);
    return run;
  };

  private async reveal(uuid: string): Promise<boolean> {
    if (this.getOrder().indexOf(uuid) < 0) {
      // Called through the feed, not detached from it — `reveal` is a method
      // and reads the work off `this`.
      if (!this.spineFeed?.reveal) return false;
      // Before the await, not after: the list renders from the top while the
      // window is in flight, and arming would prepend under the scroll that
      // is about to happen.
      this.earlierArmed = false;

      if ((await this.spineFeed.reveal(uuid)) < 0) return false;
      this.orderCache = null;
      // The spine is a different set of passages now; anything the old one
      // pinned is gone with it.
      this.live.reset();
      this.bump();
    }

    await this.hydrateOne(uuid);

    // Read the position now rather than trusting the one the feed returned:
    // anything that grew the spine in the meantime has moved it.
    const index = this.getOrder().indexOf(uuid);
    if (index < 0) return false;
    // Settled, unlike a focus move: the rows above an unvisited target are
    // estimated, and measuring them moves it — by a screenful, on a deep link.
    this.live.scrollTo(index, { settle: true });
    return true;
  }

  /** Hydrate one passage on demand — the path focus takes ahead of mounting. */
  private async hydrateOne(uuid: string) {
    if (this.work.store.has(uuid)) return;
    const doc = await this.work.store.hydrate(uuid);
    if (doc) {
      this.content.wire(doc);
      this.bump();
    }
  }

  // ------------------------------------------------------------- editors

  buildEditorExtensions(uuid: string): Extensions {
    const doc = this.work.store.peek(uuid);
    if (!doc) {
      throw new Error(`cannot mount an editor on unhydrated passage ${uuid}`);
    }
    this.content.wire(doc);
    return buildStackEditorExtensions({
      uuid,
      fragment: doc.content,
      undoManager: doc.undoManager,
      delegate: this,
    });
  }

  registerEditor(uuid: string, editor: Editor) {
    this.live.registerEditor(uuid, editor);
  }

  unregisterEditor(uuid: string) {
    this.live.unregisterEditor(uuid);
  }

  getEditor = (uuid: string) => this.live.getEditor(uuid);

  setScrollHandler(
    handler: ((index: number, options?: { settle?: boolean }) => void) | null,
  ) {
    this.live.setScrollHandler(handler);
  }

  // --------------------------------------------------------------- focus

  /** Whether this row should render as an editor rather than static HTML. */
  isLive = (uuid: string) => this.live.isLive(uuid);

  getFocusedUuid = () => this.live.getFocusedUuid();

  hasPendingFocus = () => this.live.hasPendingFocus();

  /**
   * Buffer keys typed between a focus request and the editor mounting, so a
   * click-and-immediately-type never drops characters.
   */
  bufferKey(key: string) {
    this.live.bufferKey(key);
  }

  /** Recenter the live window when an editor gains focus by any means. */
  notifyFocused(uuid: string) {
    this.live.notifyFocused(uuid);
  }

  /** The editor that currently has focus, if it is mounted. */
  getFocusedEditor = (): Editor | null => this.live.getFocusedEditor();

  /** An editor for this passage, focusing it if that is what it takes. */
  requestEditorFor = (uuid: string): Promise<Editor | null> =>
    this.live.requestEditorFor(uuid);

  focusPassage(uuid: string, where: StackFocusWhere = 'start') {
    return this.live.focusPassage(uuid, where);
  }

  focusRelative = (uuid: string, direction: -1 | 1, where: 'start' | 'end') =>
    this.live.focusRelative(uuid, direction, where);

  private applyFocusTarget(target: FocusTarget | null | undefined) {
    if (!target) return;
    this.focusPassage(target.uuid, target.where);
  }

  // ------------------------------------------------------ structural ops

  splitAtSelection = (uuid: string) => {
    const editor = this.live.getEditor(uuid);
    if (!editor) return false;
    const result = this.work.split(uuid, editor.state.selection.$from.pos);
    if (!result) return false;
    this.focusPassage(result.uuid, 'start');
    return true;
  };

  mergeWithPrevious = (uuid: string) => {
    const result = this.work.merge(uuid);
    if (!result) return false;
    this.focusPassage(result.uuid, result.boundary);
    return true;
  };

  /** Rename one passage. */
  setLabel = (uuid: string, label: string) => this.work.setLabel(uuid, label);

  /**
   * Delete a whole passage.
   *
   * Focus moves to the one taking its place: a focused uuid the spine no
   * longer holds leaves the shared surfaces bound to nothing.
   */
  removePassage = (uuid: string) => {
    const index = this.getOrder().indexOf(uuid);
    if (index < 0) return false;
    if (!this.work.remove([uuid])) return false;

    this.orderCache = null;
    const order = this.getOrder();
    const next = order[index] ?? order[index - 1];
    if (next) this.focusPassage(next, 'start');
    else {
      this.live.reset();
    }
    return true;
  };

  /** A passage's document as editor JSON, for the attributes dialog. */
  getPassageJSON = (uuid: string): JSONContent | null => {
    const doc = this.work.store.peek(uuid);
    const meta = this.work.spine.meta(uuid);
    if (!doc || !meta) return null;
    const { references, alignments } = this.extras?.get(uuid) ?? {};
    // The passage node the paginated editor shows: identity and row data as
    // attributes, the document as content.
    return {
      type: 'passage',
      attrs: {
        uuid,
        label: meta.label,
        type: meta.type,
        sort: this.work.spine.sortOf(uuid),
        ...(meta.toh ? { toh: meta.toh } : {}),
        alignments: alignments ?? {},
        ...(references?.length ? { references } : {}),
      },
      content: doc.toJSON().content ?? [],
    };
  };

  // ---------------------------------------------------- passage selection

  /** Select whole passages from `anchorUuid` through `focusUuid`. */
  setPassageSelection(anchorUuid: string, focusUuid: string) {
    this.selection.setPassageSelection(anchorUuid, focusUuid);
  }

  clearPassageSelection() {
    this.selection.clearPassageSelection();
  }

  hasPassageSelection = () => this.selection.hasPassageSelection();

  isSelected = (uuid: string) => this.selection.isSelected(uuid);

  /** The selected passages, in spine order. */
  selectedUuids = (): string[] => this.selection.selectedUuids();

  /** What a passage selection puts on the clipboard. */
  serializePassageSelection = (): { text: string; html: string } | null =>
    this.selection.serializePassageSelection();

  /** Delete the selected passages, as one command. */
  deletePassageSelection = () => this.selection.deletePassageSelection();

  /** Replace the selected passages with what the clipboard carries. */
  pastePassageSelection = (clipboard: { html: string; text: string }) =>
    this.selection.pastePassageSelection(clipboard);

  // ------------------------------------------------------------ undo/redo

  undo = () => {
    // `WorkDocument.undo` moves entries between its own stacks; the passage
    // `UndoManager` it drives fires `stack-item-added` on the way, which would
    // otherwise be recorded as a brand new text edit and clear the redo
    // branch. Suppression gates recording only — the stack moves still happen.
    const target = this.work.log.suppress(() => this.work.undo());
    if (target === null) return false;
    this.applyFocusTarget(target);
    return true;
  };

  redo = () => {
    const target = this.work.log.suppress(() => this.work.redo());
    if (target === null) return false;
    this.applyFocusTarget(target);
    return true;
  };

  // -------------------------------------------------------------- private

  private bump() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  /** Release the controller's own listeners. The work outlives it. */
  destroy() {
    // The work outlives this view, so its window has to be given back or the
    // documents only it was holding are pinned for good.
    this.work.releaseWindow(this.windowKey);
    this.content.unwireAll();
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.listeners.clear();
  }
}
