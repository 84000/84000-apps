import type { Editor } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import type { StackFocusTarget, StackFocusWhere } from './types';

/** Frames to wait for a focused passage's editor to mount. */
const EDITOR_MOUNT_FRAMES = 60;

/** The character a keydown types, if it types one rather than a shortcut. */
const keyedText = (event: KeyboardEvent) =>
  event.metaKey || event.ctrlKey || event.altKey || event.key.length !== 1
    ? null
    : event.key;

/** The text a `beforeinput` inserts, if it is plain inserted text. */
const typedText = (event: InputEvent) =>
  event.inputType === 'insertText' && !event.isComposing ? event.data : null;

/**
 * Which passages of a stack view carry a live editor, and where focus is.
 *
 * Focus-driven and small: the focused passage and its immediate neighbours.
 */
export class StackLiveEditors {
  private readonly work: WorkDocument;
  private readonly getOrder: () => string[];
  private readonly hydrateOne: (uuid: string) => Promise<void>;
  private readonly bump: () => void;

  private editors = new Map<string, Editor>();
  private pendingFocus: StackFocusTarget | null = null;
  private keyBuffer = '';
  private scrollToIndex:
    | ((index: number, options?: { settle?: boolean }) => void)
    | null = null;

  private liveUuids = new Set<string>();
  private focusedUuid: string | null = null;

  constructor(host: {
    work: WorkDocument;
    getOrder: () => string[];
    hydrateOne: (uuid: string) => Promise<void>;
    bump: () => void;
  }) {
    this.work = host.work;
    this.getOrder = host.getOrder;
    this.hydrateOne = host.hydrateOne;
    this.bump = host.bump;
  }

  mountedCount = () => this.editors.size;

  /** The passages pinned by a live editor. */
  getLiveUuids = () => this.liveUuids;

  /** Forget focus and the live set, for a spine that no longer holds them. */
  reset() {
    this.liveUuids = new Set();
    this.focusedUuid = null;
  }

  /** Scroll the view to a row, through whatever handler it installed. */
  scrollTo(index: number, options?: { settle?: boolean }) {
    this.scrollToIndex?.(index, options);
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

  setScrollHandler(
    handler: ((index: number, options?: { settle?: boolean }) => void) | null,
  ) {
    this.scrollToIndex = handler;
  }

  /** Whether this row should render as an editor rather than static HTML. */
  isLive = (uuid: string) =>
    this.liveUuids.has(uuid) && this.work.store.has(uuid);

  getFocusedUuid = () => this.focusedUuid;

  /**
   * Buffer text typed between a focus request and the editor mounting, so a
   * click-and-immediately-type never drops characters. Returns whether the
   * event was taken; the caller then prevents its default.
   *
   * Takes `beforeinput` too: inserted text (e.g. automation's `insertText`)
   * has no keydown. A taken keydown never fires `beforeinput`, so nothing is
   * buffered twice.
   */
  bufferTyping(event: KeyboardEvent | InputEvent): boolean {
    // A prevented event was already taken — by a handler, or by another stack
    // drawing this controller (the mobile layout mounts a second one).
    if (!this.pendingFocus || event.defaultPrevented) return false;
    const text =
      event.type === 'beforeinput'
        ? typedText(event as InputEvent)
        : keyedText(event as KeyboardEvent);
    if (!text) return false;
    this.keyBuffer += text;
    return true;
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

  /**
   * An editor for this passage, focusing it if that is what it takes.
   *
   * What a hover card's edit actions resolve through. A card is drawn from the
   * anchor's attributes and the navigation fetchers, so most of them open over
   * a static row with no editor at all. One is mounted when an action actually
   * needs a document to change, rather than kept alive on the chance that it
   * might — which is the difference between editing costing an editor and
   * hovering costing one.
   */
  requestEditorFor = async (uuid: string): Promise<Editor | null> => {
    const existing = this.editors.get(uuid);
    if (existing?.isEditable) return existing;
    if (!this.focusPassage(uuid, 'start')) return null;

    // Focus mounts the row on the next render; the editor arrives with it.
    return new Promise((resolve) => {
      let frames = 0;
      const look = () => {
        const editor = this.editors.get(uuid);
        if (editor?.isEditable) return resolve(editor);
        if (frames++ > EDITOR_MOUNT_FRAMES) return resolve(null);
        requestAnimationFrame(look);
      };
      look();
    });
  };

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
    this.placeCaret(editor, where);
    // `commands.focus` defers DOM focus a frame. A key typed in that frame
    // lands on the clicked static row, after the buffer has stopped taking
    // keys, and is lost.
    editor.view.focus();
  }

  private placeCaret(editor: Editor, where: StackFocusWhere) {
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

  /** Let go of any caret a live editor is holding. */
  blurEditors() {
    this.editors.forEach((editor) => editor.commands.blur());
  }
}
