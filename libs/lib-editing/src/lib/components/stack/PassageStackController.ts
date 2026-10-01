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
import { StackHydration } from './stack-hydration';
import { StackLiveEditors } from './stack-live-editors';
import { StackPassageSelectionModel } from './stack-passage-selection';
import { StackRowContent } from './stack-row-content';
import type {
  PassageExtras,
  PassageStackControllerOptions,
  StackFocusWhere,
  StackPassageSeed,
} from './types';

export type { PassageStackControllerOptions } from './types';

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
  private readonly hydration: StackHydration;
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
      hydrateOne: (uuid) => this.hydration.hydrateOne(uuid),
      bump: () => this.bump(),
    });
    this.hydration = new StackHydration({
      work: this.work,
      spineFeed: options.spineFeed,
      tab: this.tab,
      windowKey: this.windowKey,
      getOrder: this.getOrder,
      getLiveUuids: () => this.live.getLiveUuids(),
      wire: (doc) => this.content.wire(doc),
      invalidateOrder: () => {
        this.orderCache = null;
      },
      resetLive: () => this.live.reset(),
      scrollTo: (index, options) => this.live.scrollTo(index, options),
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

  /** Whether a window load is in flight. */
  isHydrating = () => this.hydration.isHydrating();

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

  /** Tell the controller which rows the virtualizer is drawing. */
  setVisibleRange = (range: SpineRange) =>
    this.hydration.setVisibleRange(range);

  /** Whether the work has passages before the ones the spine holds. */
  hasEarlierPassages = () => this.hydration.hasEarlierPassages();

  /** Whether the work has passages the spine has not loaded yet. */
  hasMorePassages = () => this.hydration.hasMorePassages();

  /**
   * Scroll a passage into view, loading it into the spine if the window does
   * not hold it.
   */
  revealPassage = (uuid: string): Promise<boolean> =>
    this.hydration.revealPassage(uuid);

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
    else this.live.reset();
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
