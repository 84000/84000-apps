import { Editor, Extensions } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import { getBookmarks } from '@eightyfourthousand/data-access';
import {
  rowKindOf,
  type FocusTarget,
  type PassageMeta,
  type SpineRange,
  type WorkDocument,
} from '@eightyfourthousand/lib-doc-model';
import type { PassageReference } from '../editor/extensions/Passage/PassageNode.ssr';

import * as bibliography from './bibliography-structure';
import { bibliographyRowStyle, type StackRowStyle } from './row-classes';
import { StackHydration } from './stack-hydration';
import { StackLiveEditors } from './stack-live-editors';
import { StackPassageSelectionModel } from './stack-passage-selection';
import { StackRowContent } from './stack-row-content';
import { trackTextOrigin } from './stack-work';
import type {
  PassageExtras,
  StackControllerOptions,
  StackEditing,
  StackFocusWhere,
  StackScrollHandler,
  StackPassageSeed,
  StackRows,
} from './types';

export type {
  PassageStackControllerOptions,
  StackControllerOptions,
} from './types';

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
 *
 * On its own it is a reader's view: it can mount no editor, because the
 * editing layer is handed to it (`options.editing`) rather than imported, and
 * that is what keeps a reader's module graph free of the editor.
 * `PassageStackController` is this with the editing layer.
 */
export class StackController {
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
  private readonly editing: StackEditing | null;
  private readonly windowKey: string;
  private readonly tab?: string;
  private readonly rows: StackRows;
  private bookmarks = new Set<string>();

  private listeners = new Set<() => void>();
  private version = 0;
  private disposers: (() => void)[] = [];
  private extras?: ReadonlyMap<string, PassageExtras>;

  constructor(options: StackControllerOptions) {
    this.work = options.work;
    this.editing = options.editing ?? null;
    this.readOnly = !this.editing || (options.readOnly ?? false);
    if (this.editing) trackTextOrigin(this.work, this.editing.textOrigin);
    this.tab = options.tab;
    this.rows = options.rows ?? 'passages';
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
      hydrate: (uuids) => this.hydration.hydrateSome(uuids),
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

  /**
   * Reader rather than studio. A read-only view mounts no editor and changes
   * nothing in the work: rows stay static HTML.
   */
  isReadOnly = () => this.readOnly;

  /** The editing layer this view was given, or null for a reader's view. */
  getEditing = () => this.editing;

  /**
   * Switch between reader and studio while the view is drawn.
   *
   * Turning read-only lets go of every editor, so each row redraws as static
   * HTML. Edits already made stay in the work and can still be saved.
   */
  setReadOnly = (requested: boolean) => {
    // Without the editing layer there is nothing to edit with.
    const readOnly = requested || !this.editing;
    if (this.readOnly === readOnly) return;
    this.readOnly = readOnly;
    if (readOnly) {
      this.live.release();
      this.selection.clearPassageSelection();
    }
    this.bump();
  };

  /** The tab this view draws, which is also what names its panel. */
  getTab = () => this.tab;

  /** What the rows are. */
  getRows = () => this.rows;

  /** Whether rows can be split, merged, deleted and replaced here. */
  restructures = () => this.rows === 'passages' && !this.readOnly;

  /** A row's own presentation. A passage has none: its blocks carry it. */
  rowStyle = (meta: PassageMeta): StackRowStyle =>
    this.rows === 'bibliography' ? bibliographyRowStyle(meta) : {};

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

  /** The Compare column's top margin for a passage, from its first block. */
  getCompareLead = (uuid: string): string => this.content.getCompareLead(uuid);

  /** Tell the controller which rows the virtualizer is drawing. */
  setVisibleRange = (range: SpineRange) =>
    this.hydration.setVisibleRange(range);

  /** Whether the work has passages before the ones the spine holds. */
  hasEarlierPassages = () => this.hydration.hasEarlierPassages();

  /** Whether the work has passages the spine has not loaded yet. */
  hasMorePassages = () => this.hydration.hasMorePassages();

  /**
   * A page of this tab's passages past `cursor`, read without moving the
   * window. Null when it can't be read.
   */
  readBeyond = (direction: 'before' | 'after', cursor: string) =>
    this.hydration.readBeyond(direction, cursor);

  /**
   * Scroll a passage into view, loading it into the spine if the window does
   * not hold it.
   */
  revealPassage = (uuid: string): Promise<boolean> =>
    this.hydration.revealPassage(uuid);

  /** Move the window to the start of this tab's run, if it opens later. */
  revealStart = (): Promise<void> => this.hydration.revealStart();

  // ------------------------------------------------------------- editors

  buildEditorExtensions(uuid: string): Extensions {
    if (!this.editing) {
      throw new Error(
        `cannot mount an editor on ${uuid}: the view is read-only`,
      );
    }
    const doc = this.work.store.peek(uuid);
    if (!doc) {
      throw new Error(`cannot mount an editor on unhydrated passage ${uuid}`);
    }
    this.content.wire(doc);
    const binding = {
      uuid,
      fragment: doc.content,
      undoManager: doc.undoManager,
      delegate: this,
    };
    if (this.rows === 'bibliography') {
      const meta = this.work.spine.meta(uuid);
      return this.editing.bibliographyExtensions({
        ...binding,
        kind: meta ? rowKindOf(meta.type) : 'entry',
        ...(this.editsOutline() ? { outline: this } : {}),
      });
    }
    return this.editing.passageExtensions(binding);
  }

  registerEditor(uuid: string, editor: Editor) {
    this.live.registerEditor(uuid, editor);
  }

  unregisterEditor(uuid: string) {
    this.live.unregisterEditor(uuid);
  }

  getEditor = (uuid: string) => this.live.getEditor(uuid);

  /**
   * Install a drawn copy's scroll handler; each copy of the view installs its
   * own. Returns a function that removes it.
   */
  addScrollHandler(handler: StackScrollHandler) {
    return this.live.addScrollHandler(handler);
  }

  // --------------------------------------------------------------- focus

  /** Whether this row should render as an editor rather than static HTML. */
  isLive = (uuid: string) => !this.readOnly && this.live.isLive(uuid);

  getFocusedUuid = () => this.live.getFocusedUuid();

  /**
   * Buffer text typed between a focus request and the editor mounting, so a
   * click-and-immediately-type never drops characters. Returns whether the
   * event was taken; the caller then prevents its default.
   */
  bufferTyping(event: KeyboardEvent | InputEvent) {
    return !this.readOnly && this.live.bufferTyping(event);
  }

  /** Recenter the live window when an editor gains focus by any means. */
  notifyFocused(uuid: string) {
    this.live.notifyFocused(uuid);
  }

  /** The editor that currently has focus, if it is mounted. */
  getFocusedEditor = (): Editor | null =>
    this.readOnly ? null : this.live.getFocusedEditor();

  /**
   * An editor for this passage, focusing it if that is what it takes. Null
   * when read-only.
   */
  requestEditorFor = (uuid: string): Promise<Editor | null> =>
    this.readOnly ? Promise.resolve(null) : this.live.requestEditorFor(uuid);

  /** Focus a passage, mounting its editor. Refused when read-only. */
  focusPassage(uuid: string, where: StackFocusWhere = 'start') {
    if (this.readOnly) return false;
    return this.live.focusPassage(uuid, where);
  }

  focusRelative = (uuid: string, direction: -1 | 1, where: 'start' | 'end') =>
    this.live.focusRelative(uuid, direction, where);

  private applyFocusTarget(target: FocusTarget | null | undefined) {
    if (!target) return;
    this.focusPassage(target.uuid, target.where);
  }

  // ------------------------------------------------------ structural ops

  splitAtSelection = (uuid: string, at?: number) => {
    if (this.editsOutline() && this.isHeadingRow(uuid)) {
      // A heading is one line: what follows it is its first entry.
      return this.focusMade(bibliography.newBibliographyEntry(this.work, uuid));
    }
    if (!this.restructuresRows()) return false;
    const pos = at ?? this.live.getEditor(uuid)?.state.selection.$from.pos;
    if (pos === undefined) return false;
    const result = this.work.split(uuid, pos);
    if (!result) return false;
    this.focusPassage(result.uuid, 'start');
    return true;
  };

  mergeWithPrevious = (uuid: string) => {
    if (!this.restructuresRows()) return false;
    if (
      this.rows === 'bibliography' &&
      !bibliography.canMergeBibliographyRow(this.work, uuid)
    ) {
      return false;
    }
    const result = this.work.merge(uuid);
    if (!result) return false;
    this.focusPassage(result.uuid, result.boundary);
    return true;
  };

  /** Rename one passage. */
  setLabel = (uuid: string, label: string) =>
    !this.readOnly && this.work.setLabel(uuid, label);

  /**
   * Delete a whole passage.
   *
   * Focus moves to the one taking its place: a focused uuid the spine no
   * longer holds leaves the shared surfaces bound to nothing.
   *
   * A passage not yet loaded is loaded first, so undo has its content to put
   * back; otherwise the delete is synchronous.
   */
  removePassage = async (uuid: string): Promise<boolean> => {
    const removable = () =>
      this.restructuresRows() &&
      this.canRemove(uuid) &&
      this.getOrder().includes(uuid);
    if (!removable()) return false;
    if (!this.work.store.has(uuid)) {
      await this.hydration.hydrateOne(uuid);
      if (!this.work.store.has(uuid) || !removable()) return false;
    }
    const index = this.getOrder().indexOf(uuid);
    if (!this.work.remove([uuid])) return false;

    this.orderCache = null;
    const order = this.getOrder();
    const next = order[index] ?? order[index - 1];
    if (next) this.focusPassage(next, 'start');
    else this.live.reset();
    return true;
  };

  /** A row's text, when its document is held. */
  getRowText = (uuid: string) => this.work.store.peek(uuid)?.text ?? '';

  /** Whether a row can be deleted: in a bibliography, a heading once empty. */
  canRemove = (uuid: string) =>
    this.rows !== 'bibliography' ||
    bibliography.canDeleteBibliographyRow(this.work, uuid);

  // ------------------------------------------------- bibliography outline

  /** Start a bibliography entry after a row, and focus it. */
  newBibliographyEntry = (uuid: string) =>
    this.editsOutline() &&
    this.focusMade(bibliography.newBibliographyEntry(this.work, uuid));

  /** Start a heading after a row's heading, or nested in it, and focus it. */
  newBibliographyHeading = (uuid: string, nested = false) =>
    this.editsOutline() &&
    this.focusMade(
      bibliography.newBibliographyHeading(this.work, uuid, { nested }),
    );

  canIndentBibliographyHeading = (uuid: string) =>
    this.editsOutline() &&
    bibliography.canIndentBibliographyHeading(this.work, uuid);

  /** Nest a heading under the heading before it. */
  indentBibliographyHeading = (uuid: string) =>
    this.editsOutline() &&
    bibliography.indentBibliographyHeading(this.work, uuid);

  canOutdentBibliographyHeading = (uuid: string) =>
    this.editsOutline() &&
    bibliography.canOutdentBibliographyHeading(this.work, uuid);

  /** Take a heading out of its parent. */
  outdentBibliographyHeading = (uuid: string) =>
    this.editsOutline() &&
    bibliography.outdentBibliographyHeading(this.work, uuid);

  /** The headings a row can move under. */
  bibliographyMoveTargets = (uuid: string): PassageMeta[] =>
    this.editsOutline()
      ? bibliography.bibliographyMoveTargets(this.work, uuid)
      : [];

  /** Move a row under a heading, or a heading to the top level. */
  moveBibliographyRow = (uuid: string, target: string | null) => {
    if (!this.editsOutline()) return false;
    if (!bibliography.moveBibliographyRow(this.work, uuid, target))
      return false;
    this.focusPassage(uuid, 'start');
    return true;
  };

  private isHeadingRow(uuid: string) {
    const meta = this.work.spine.meta(uuid);
    return !!meta && rowKindOf(meta.type) === 'heading';
  }

  /** Whether a bibliography's rows can be added, nested and moved here. */
  editsOutline = () => this.rows === 'bibliography' && !this.readOnly;

  /** Whether rows split, merge and delete here. */
  private restructuresRows = () => this.restructures() || this.editsOutline();

  /** Focus the row an edit made, if it made one. */
  private focusMade(uuid: string | null) {
    if (!uuid) return false;
    this.orderCache = null;
    this.focusPassage(uuid, 'start');
    return true;
  }

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

  /**
   * Select whole passages from `anchorUuid` through `focusUuid`. A reader
   * selects text natively instead, so this does nothing when read-only.
   */
  setPassageSelection(anchorUuid: string, focusUuid: string) {
    if (this.readOnly) return;
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
  deletePassageSelection = async (): Promise<boolean> =>
    this.restructures() && this.selection.deletePassageSelection();

  /** Replace the selected passages with what the clipboard carries. */
  pastePassageSelection = async (clipboard: {
    html: string;
    text: string;
  }): Promise<boolean> =>
    this.restructures() && this.selection.pastePassageSelection(clipboard);

  // ------------------------------------------------------------ undo/redo

  undo = () => {
    if (this.readOnly) return false;
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
    if (this.readOnly) return false;
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
