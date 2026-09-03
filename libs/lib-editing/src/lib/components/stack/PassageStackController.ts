import { Editor, Extensions } from '@tiptap/core';
import { Selection, TextSelection } from '@tiptap/pm/state';
import type { UndoManager } from 'yjs';
import type {
  FocusTarget,
  PassageDoc,
  PassageMeta,
  SpineRange,
  WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import { renderTranslationHTML } from '../reader/translation-html';
import { buildStackEditorExtensions } from './stack-extensions';
import type {
  StackCrossSelection,
  StackFocusTarget,
  StackFocusWhere,
  StackPassageSeed,
} from './types';

/** Rough characters per rendered line, for unmeasured row height estimates. */
const CHARS_PER_LINE = 85;
/** Row chrome (label gutter, vertical padding) in pixels. */
const ROW_CHROME_PX = 48;
/** One line of rendered passage text, in pixels. */
const LINE_HEIGHT_PX = 28;
/** Fallback height for a passage whose size is entirely unknown. */
const UNKNOWN_ROW_PX = 64;

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
  };
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

  private editors = new Map<string, Editor>();
  private charCounts = new Map<string, number>();
  private staticHTML = new Map<string, string>();
  /** Per-hydrated-document teardown: content observer + undo bookkeeping. */
  private wiring = new Map<string, () => void>();

  private crossSelection: StackCrossSelection | null = null;
  private pendingFocus: StackFocusTarget | null = null;
  private keyBuffer = '';
  private scrollToIndex: ((index: number) => void) | null = null;

  private liveUuids = new Set<string>();
  private focusedUuid: string | null = null;

  private orderCache: string[] | null = null;
  private visibleRange: SpineRange = { start: 0, end: 0 };
  private hydrating = false;
  private hydrationQueued = false;

  private spineFeed?: PassageStackControllerOptions['spineFeed'];

  private listeners = new Set<() => void>();
  private version = 0;
  private disposers: (() => void)[] = [];

  constructor(options: PassageStackControllerOptions) {
    this.work = options.work;
    this.spineFeed = options.spineFeed;
    if (options.charCounts) {
      this.charCounts = new Map(options.charCounts);
    }

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
        this.reconcileWiring();
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
      this.orderCache = this.work.spine.uuids();
    }
    return this.orderCache;
  };

  getMeta = (uuid: string): PassageMeta | null => this.work.spine.meta(uuid);

  passageCount = () => this.work.spine.length;

  mountedCount = () => this.editors.size;

  undoDepth = () => this.work.log.depth;

  /** Whether this passage's document is in memory and can be rendered. */
  isHydrated = (uuid: string) => this.work.store.has(uuid);

  /** The whole row's height, for the virtualizer's initial estimate. */
  estimateHeight = (uuid: string) =>
    ROW_CHROME_PX + this.estimateContentHeight(uuid);

  /** Just the text column, for sizing a placeholder inside an existing row. */
  estimateContentHeight = (uuid: string) => {
    const count = this.charCounts.get(uuid);
    if (count === undefined) return UNKNOWN_ROW_PX;
    return Math.ceil(count / CHARS_PER_LINE) * LINE_HEIGHT_PX;
  };

  /**
   * Static HTML for a row that doesn't carry a live editor, or null when the
   * passage has not been hydrated.
   *
   * Null is not an error state — outside the hydration window there is
   * genuinely no content to draw, and the row shows a skeleton at its
   * estimated height instead. The prototype never had this case because it
   * held every passage in memory, which is exactly what does not scale.
   *
   * Rendered through the reader's own renderer, not the stack's schema set.
   * Static rendering needs the `*.ssr` variant of every extension whose
   * interactive form draws through a React node view, plus the `endNoteLink`
   * mark mapping — rendering with the schema set silently dropped endnote
   * markers from every static row while the editor showed them. The schema set
   * is for parsing; this is for drawing, and they are not the same list.
   *
   * Cached per passage because the render is not cheap and a row re-renders on
   * every controller bump. Invalidated by `wire`'s content observer.
   */
  getStaticHTML = (uuid: string): string | null => {
    const cached = this.staticHTML.get(uuid);
    if (cached !== undefined) return cached;

    const doc = this.work.store.peek(uuid);
    if (!doc) return null;

    const html =
      renderTranslationHTML({ content: doc.toJSON() }) ?? `<p>${doc.text}</p>`;
    this.staticHTML.set(uuid, html);
    return html;
  };

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
    // The spine is only as long as the pages fetched so far, so approaching its
    // end has to pull the next one before there is anything to hydrate.
    this.spineFeed?.maybeExtend(range.end);
    void this.runHydration();
  };

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
        const docs = await this.work.hydrateWindow(this.visibleRange, {
          keep: this.liveUuids,
        });
        docs.forEach((doc) => this.wire(doc));
      } while (this.hydrationQueued);
    } finally {
      this.hydrating = false;
    }
    this.bump();
  }

  /** Hydrate one passage on demand — the path focus takes ahead of mounting. */
  private async hydrateOne(uuid: string) {
    if (this.work.store.has(uuid)) return;
    const doc = await this.work.store.hydrate(uuid);
    if (doc) {
      this.wire(doc);
      this.bump();
    }
  }

  // ------------------------------------------------------------- editors

  buildEditorExtensions(uuid: string): Extensions {
    const doc = this.work.store.peek(uuid);
    if (!doc) {
      throw new Error(`cannot mount an editor on unhydrated passage ${uuid}`);
    }
    this.wire(doc);
    return buildStackEditorExtensions({
      uuid,
      fragment: doc.content,
      undoManager: doc.undoManager,
      delegate: this,
    });
  }

  registerEditor(uuid: string, editor: Editor) {
    this.editors.set(uuid, editor);

    if (this.pendingFocus?.uuid === uuid) {
      const { where } = this.pendingFocus;
      this.pendingFocus = null;
      this.focusEditor(editor, where);
      if (this.keyBuffer) {
        editor.commands.insertContent(this.keyBuffer);
        this.keyBuffer = '';
      }
    }

    // The shared editing surfaces bind to `getFocusedEditor()`, which is null
    // until the editor registers. Focusing a passage renders its row as an
    // editor, the editor mounts and lands here — without this the menu is
    // still holding the null it was rendered with and never appears.
    if (this.focusedUuid === uuid) this.bump();
  }

  unregisterEditor(uuid: string) {
    this.editors.delete(uuid);
    // Same reason in reverse: a surface bound to this editor has to let go.
    if (this.focusedUuid === uuid) this.bump();
  }

  getEditor = (uuid: string) => this.editors.get(uuid) ?? null;

  setScrollHandler(handler: ((index: number) => void) | null) {
    this.scrollToIndex = handler;
  }

  // --------------------------------------------------------------- focus

  /** Whether this row should render as an editor rather than static HTML. */
  isLive = (uuid: string) =>
    this.liveUuids.has(uuid) && this.work.store.has(uuid);

  getFocusedUuid = () => this.focusedUuid;

  hasPendingFocus = () => this.pendingFocus !== null;

  /**
   * Buffer keys typed between a focus request and the editor mounting, so a
   * click-and-immediately-type never drops characters.
   */
  bufferKey(key: string) {
    if (this.pendingFocus) this.keyBuffer += key;
  }

  /**
   * Recenter the live window when an editor gains focus by any means.
   *
   * Bumps on a change of focus, not only on a change of live set. The shared
   * bubble menu is bound to whichever editor has focus, so it has to re-render
   * when focus moves between two passages that are both already live — which
   * `recenterLive` alone would not report.
   */
  notifyFocused(uuid: string) {
    const changed = this.focusedUuid !== uuid;
    this.focusedUuid = uuid;
    this.recenterLive(uuid);
    if (changed) this.bump();
  }

  /**
   * The editor that currently has focus, if it is mounted.
   *
   * What the shared editing surfaces bind to: only one passage is editable at a
   * time, so a bubble menu per row would be a popover per row watching nothing.
   */
  getFocusedEditor = (): Editor | null =>
    this.focusedUuid ? (this.editors.get(this.focusedUuid) ?? null) : null;

  focusPassage(uuid: string, where: StackFocusWhere = 'start') {
    const index = this.getOrder().indexOf(uuid);
    if (index < 0) return false;

    this.focusedUuid = uuid;
    this.recenterLive(uuid);

    const editor = this.editors.get(uuid);
    if (editor) {
      this.focusEditor(editor, where);
      this.scrollToIndex?.(index);
      return true;
    }

    this.pendingFocus = { uuid, where };
    this.keyBuffer = '';
    this.scrollToIndex?.(index);
    // Either the row is static and re-rendering swaps it to an editor, or the
    // passage is not hydrated yet and mounting waits on its document.
    void this.hydrateOne(uuid);
    this.bump();
    return true;
  }

  focusRelative = (uuid: string, direction: -1 | 1, where: 'start' | 'end') => {
    const order = this.getOrder();
    const index = order.indexOf(uuid);
    const target = order[index + direction];
    if (index < 0 || !target) return false;
    return this.focusPassage(target, where);
  };

  private recenterLive(uuid: string) {
    const order = this.getOrder();
    const index = order.indexOf(uuid);
    if (index < 0) return;
    const next = new Set<string>();
    [order[index - 1], uuid, order[index + 1]].forEach((neighbour) => {
      if (neighbour) next.add(neighbour);
    });
    const changed =
      next.size !== this.liveUuids.size ||
      [...next].some((entry) => !this.liveUuids.has(entry));
    if (!changed) return;
    this.liveUuids = next;
    // Neighbours are premounted so boundary arrow keys land in an editor that
    // already exists; they need documents for that.
    next.forEach((entry) => void this.hydrateOne(entry));
    this.bump();
  }

  private focusEditor(editor: Editor, where: StackFocusWhere) {
    // Premounted neighbors are non-editable (so at most one contenteditable
    // exists and native selection works everywhere else) — flip on focus.
    if (!editor.isEditable) editor.setEditable(true);
    if (typeof where === 'object') {
      // A click on a static row: land the caret where the user clicked.
      const coords = editor.view.posAtCoords({ left: where.x, top: where.y });
      editor.commands.focus(coords ? Math.max(1, coords.pos) : 'start');
      return;
    }
    if (typeof where === 'number') {
      // A position from the doc model — a merge's join point, a split's caret,
      // the start of a cross-passage delete. It is a document offset, not
      // necessarily a place a caret can sit: a merge's boundary is the size of
      // the head's content, which lands *between* two blocks rather than
      // inside either. Left there, the caret is in no textblock at all, and the
      // next Backspace selects the preceding block instead of joining — which
      // is what put the bubble menu over a freshly merged passage.
      //
      // `TextSelection.near` with a backward bias resolves it to the nearest
      // real caret position, which at a join is the end of the head's text.
      const { doc } = editor.state;
      const clamped = Math.max(0, Math.min(where, doc.content.size));
      const near = TextSelection.near(doc.resolve(clamped), -1);
      editor.commands.focus(near.from);
      return;
    }
    editor.commands.focus(where);
  }

  private applyFocusTarget(target: FocusTarget | null | undefined) {
    if (!target) return;
    this.focusPassage(target.uuid, target.where);
  }

  // ------------------------------------------------------ structural ops

  splitAtSelection = (uuid: string) => {
    const editor = this.editors.get(uuid);
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

  /**
   * Map a DOM point to a ProseMirror position, whether the passage is a
   * live editor (exact, via posAtDOM) or a static row (approximate, via the
   * text offset from the row start — inline atoms can skew it by a char).
   */
  resolvePoint = (uuid: string, node: Node, offset: number): number | null => {
    const editor = this.editors.get(uuid);
    if (editor) {
      try {
        return editor.view.posAtDOM(node, offset);
      } catch {
        return null;
      }
    }

    const row = document.querySelector(
      `[data-stack-passage="${uuid}"] .tiptap`,
    );
    if (!row) return null;
    const range = document.createRange();
    try {
      range.setStart(row, 0);
      range.setEnd(node, offset);
    } catch {
      return null;
    }
    return this.posFromTextOffset(uuid, range.toString().length);
  };

  private posFromTextOffset(uuid: string, textOffset: number): number | null {
    const doc = this.work.store.peek(uuid);
    if (!doc) return null;
    const node = doc.toNode();
    let remaining = textOffset;
    let pos: number | null = null;
    node.descendants((child, childPos) => {
      if (pos !== null) return false;
      if (child.isText) {
        const length = child.text?.length ?? 0;
        if (remaining <= length) {
          pos = childPos + remaining;
          return false;
        }
        remaining -= length;
      }
      return true;
    });
    return pos ?? node.content.size;
  }

  // ---------------------------------------------------- cross selection

  setCrossSelection(selection: StackCrossSelection | null) {
    this.crossSelection = selection;
  }

  hasCrossSelection = () => this.crossSelection !== null;

  /**
   * Replace a cross-passage selection with pasted plain text.
   *
   * The delete is one command; the insertion that follows is a second, because
   * `WorkDocument.deleteRange` has no insert half. So an undo after pasting
   * over a multi-passage selection takes two steps rather than one. Recorded
   * as a known gap for the selection slice of DEV-710 rather than papered over
   * here.
   */
  pasteCrossSelection = (text: string) => {
    const selection = this.crossSelection;
    if (!selection) return false;
    const start = this.orderedSelection(selection);
    if (!this.deleteCrossSelection()) return false;
    if (!start) return true;

    const editor = this.editors.get(start.uuid);
    if (editor) {
      editor.commands.insertContentAt(
        Math.min(start.pos, Selection.atEnd(editor.state.doc).from),
        text,
      );
    } else {
      // The surviving passage has no editor yet; focus queued the mount, so
      // hand the text to the same buffer a click-and-type uses.
      this.keyBuffer = text;
    }
    return true;
  };

  deleteCrossSelection = () => {
    const selection = this.crossSelection;
    if (!selection) return false;
    this.crossSelection = null;

    const deleted = this.work.deleteRange(
      selection.fromUuid,
      selection.fromPos,
      selection.toUuid,
      selection.toPos,
    );
    if (!deleted) return false;

    window.getSelection()?.removeAllRanges();
    const start = this.orderedSelection(selection);
    if (start) this.focusPassage(start.uuid, start.pos);
    return true;
  };

  /** Which end of a cross-passage selection comes first in the spine. */
  private orderedSelection(selection: StackCrossSelection) {
    const order = this.getOrder();
    const fromIndex = order.indexOf(selection.fromUuid);
    const toIndex = order.indexOf(selection.toUuid);
    if (fromIndex < 0 || toIndex < 0) return null;
    return fromIndex <= toIndex
      ? { uuid: selection.fromUuid, pos: selection.fromPos }
      : { uuid: selection.toUuid, pos: selection.toPos };
  }

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

  /**
   * Attach the controller's per-document bookkeeping, once per document.
   *
   * Two jobs. Content changes invalidate the cached static HTML and the row's
   * height estimate. And a text edit taken by the passage's own `UndoManager`
   * has to be announced to the command log, or Mod-Z would skip straight past
   * typing to the last structural op — `WorkDocument.recordTextEdit` exists
   * for exactly this and nothing in the model calls it.
   */
  private wire(doc: PassageDoc) {
    if (this.wiring.has(doc.uuid)) return;
    const uuid = doc.uuid;

    this.charCounts.set(uuid, doc.text.length);

    const unobserve = doc.observe(() => {
      this.staticHTML.delete(uuid);
      this.charCounts.set(uuid, doc.text.length);
      this.bump();
    });

    const onStackItem = ({ type }: { type: 'undo' | 'redo' }) => {
      // A redo-stack item is the inverse produced by an undo, not a new edit.
      if (type !== 'undo') return;
      this.work.recordTextEdit(uuid);
    };
    doc.undoManager.on('stack-item-added', onStackItem);

    // The y-undo plugin destroys whatever UndoManager it is handed when its
    // editor unmounts, but this one belongs to the document and has to
    // outlive every mount — otherwise typing, scrolling away and scrolling
    // back would silently lose that passage's history. `PassageDoc.destroy`
    // tears down the Yjs types it observes, so the neutered call leaks
    // nothing.
    const manager = doc.undoManager as UndoManager & { destroy: () => void };
    manager.destroy = () => undefined;

    this.wiring.set(uuid, () => {
      unobserve();
      doc.undoManager.off('stack-item-added', onStackItem);
    });
  }

  /** Drop bookkeeping for documents the store has released. */
  private reconcileWiring() {
    [...this.wiring.keys()].forEach((uuid) => {
      if (this.work.store.has(uuid)) return;
      this.wiring.get(uuid)?.();
      this.wiring.delete(uuid);
      this.staticHTML.delete(uuid);
      // The passage's text history went with its document; the command log
      // would otherwise stall on entries it can no longer replay.
      this.work.log.forgetText(uuid);
    });
  }

  private bump() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }

  /** Release the controller's own listeners. The work outlives it. */
  destroy() {
    this.wiring.forEach((teardown) => teardown());
    this.wiring.clear();
    this.disposers.forEach((dispose) => dispose());
    this.disposers = [];
    this.listeners.clear();
  }
}
