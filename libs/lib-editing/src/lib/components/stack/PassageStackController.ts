import {
  Editor,
  Extensions,
  JSONContent,
  getSchema,
} from '@tiptap/core';
import { Node as PMNode, Schema } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';
import { Transform } from '@tiptap/pm/transform';
import { Doc, UndoManager, XmlFragment, transact } from 'yjs';
import {
  prosemirrorToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from 'y-prosemirror';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import {
  defaultDeleteFilter,
  defaultProtectedNodes,
  ySyncPluginKey,
} from '@tiptap/y-tiptap';
import type { TranslationEditorContentItem } from '@eightyfourthousand/data-access';

import { incrementLabel } from '../editor/extensions/Passage/label';
import { renderMentionToHTMLString } from '../editor/extensions/Mention/mentionSSRMapping';
import {
  buildStackEditorExtensions,
  buildStackSchemaExtensions,
} from './stack-extensions';
import { stackPerf } from './perf';
import type {
  StackCrossSelection,
  StackFocusTarget,
  StackPassageMeta,
  StackPassageSeed,
} from './types';

/**
 * Origin for structural Yjs transactions (split/merge/cross-passage delete
 * and their undo). Per-passage UndoManagers track only the sync-plugin
 * origin, so structural mutations never land in a passage's text history —
 * they are undone atomically through the command log instead.
 */
const STRUCTURAL_ORIGIN = 'passage-stack-structural';

const EMPTY_PARAGRAPH: JSONContent = { type: 'paragraph' };

type StackEntry = {
  meta: StackPassageMeta;
  seedContent: TranslationEditorContentItem[] | null;
  charCount: number;
  ydoc: Doc | null;
  fragment: XmlFragment | null;
  editor: Editor | null;
  /**
   * Owned by the controller and shared with every editor mounted for this
   * passage, so text-undo history survives focus moving elsewhere. Works
   * headless — undoing an unmounted passage mutates its fragment directly.
   */
  undoManager: UndoManager | null;
};

type StructuralState = {
  order: string[];
  metas: [string, StackPassageMeta][];
  docs: { uuid: string; json: JSONContent }[];
};

type LogEntry =
  | { kind: 'text'; uuid: string }
  | {
      kind: 'structural';
      label: string;
      before: StructuralState;
      after: StructuralState;
      focusAfterUndo?: StackFocusTarget;
      focusAfterRedo?: StackFocusTarget;
    };

/**
 * Owns the spine (ordered passage uuids + metadata), one Yjs doc per
 * passage, structural operations across passages, and the stack-wide
 * command-log undo. Editors mount and unmount freely as the virtualized
 * window moves; the controller is the stable coordinator between them.
 */
export class PassageStackController {
  private schema: Schema;
  private entries = new Map<string, StackEntry>();
  private order: string[] = [];

  private undoLog: LogEntry[] = [];
  private redoLog: LogEntry[] = [];
  private suppressTextLog = false;

  private staticHTML = new Map<string, string>();
  private crossSelection: StackCrossSelection | null = null;
  private pendingFocus: StackFocusTarget | null = null;
  private keyBuffer = '';
  private scrollToIndex: ((index: number) => void) | null = null;

  /**
   * Passages carrying a live editor: the focused passage and its neighbors
   * (so boundary arrow keys land in an already-mounted editor). Everything
   * else renders as static HTML — editors mount on focus, never on scroll.
   */
  private liveUuids = new Set<string>();
  private focusedUuid: string | null = null;

  private listeners = new Set<() => void>();
  private version = 0;

  constructor(seeds: StackPassageSeed[]) {
    this.schema = getSchema(buildStackSchemaExtensions());
    seeds.forEach((seed) => {
      this.entries.set(seed.meta.uuid, {
        meta: seed.meta,
        seedContent: seed.content,
        charCount: seed.charCount,
        ydoc: null,
        fragment: null,
        editor: null,
        undoManager: null,
      });
      this.order.push(seed.meta.uuid);
    });
  }

  // ---------------------------------------------------------------- spine

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  getOrder = () => this.order;

  getMeta = (uuid: string) => this.entries.get(uuid)?.meta;

  mountedCount = () =>
    [...this.entries.values()].filter((entry) => entry.editor).length;

  passageCount = () => this.order.length;

  estimateHeight = (uuid: string) => {
    const entry = this.entries.get(uuid);
    if (!entry) return 64;
    return 48 + Math.ceil(entry.charCount / 85) * 28;
  };

  /**
   * Static HTML for rows that don't carry a live editor — cheap enough to
   * render during fast scrolling, so the stack never shows blank rows.
   * Cached per passage; invalidated by edits and structural ops.
   */
  getStaticHTML = (uuid: string) => {
    const cached = this.staticHTML.get(uuid);
    if (cached !== undefined) return cached;

    let html = '';
    try {
      html = renderToHTMLString({
        content: this.getDocJSON(uuid),
        extensions: buildStackSchemaExtensions(),
        options: { nodeMapping: { mention: renderMentionToHTMLString } },
      });
    } catch (error) {
      console.error('failed to statically render passage', error);
      html = `<p>${this.pmDoc(this.getDocJSON(uuid)).textContent}</p>`;
    }
    this.staticHTML.set(uuid, html);
    return html;
  };

  // ------------------------------------------------------------- editors

  buildEditorExtensions(uuid: string): Extensions {
    const entry = this.materialize(uuid);
    return buildStackEditorExtensions({
      uuid,
      fragment: entry.fragment as XmlFragment,
      undoManager: entry.undoManager as UndoManager,
      delegate: this,
    });
  }

  registerEditor(uuid: string, editor: Editor) {
    const entry = this.entries.get(uuid);
    if (!entry) return;

    entry.editor = editor;

    if (this.pendingFocus?.uuid === uuid) {
      const { where } = this.pendingFocus;
      this.pendingFocus = null;
      this.focusEditor(editor, where);
      if (this.keyBuffer) {
        editor.commands.insertContent(this.keyBuffer);
        this.keyBuffer = '';
      }
    }
  }

  unregisterEditor(uuid: string) {
    const entry = this.entries.get(uuid);
    if (!entry) return;
    entry.editor = null;
  }

  getEditor = (uuid: string) => this.entries.get(uuid)?.editor ?? null;

  setScrollHandler(handler: ((index: number) => void) | null) {
    this.scrollToIndex = handler;
  }

  // --------------------------------------------------------------- focus

  isLive = (uuid: string) => this.liveUuids.has(uuid);

  getFocusedUuid = () => this.focusedUuid;

  hasPendingFocus = () => this.pendingFocus !== null;

  /**
   * Buffer keys typed between a focus request and the editor mounting, so a
   * click-and-immediately-type never drops characters.
   */
  bufferKey(key: string) {
    if (this.pendingFocus) this.keyBuffer += key;
  }

  /** Recenter the live window when an editor gains focus by any means. */
  notifyFocused(uuid: string) {
    this.focusedUuid = uuid;
    this.recenterLive(uuid);
  }

  focusPassage(uuid: string, where: StackFocusTarget['where'] = 'start') {
    const entry = this.entries.get(uuid);
    const index = this.order.indexOf(uuid);
    if (!entry || index < 0) return false;

    this.focusedUuid = uuid;
    this.recenterLive(uuid);

    if (entry.editor) {
      this.focusEditor(entry.editor, where);
      this.scrollToIndex?.(index);
      return true;
    }

    this.pendingFocus = { uuid, where };
    this.keyBuffer = '';
    this.scrollToIndex?.(index);
    // The row is currently static — re-render so it swaps to an editor.
    this.bump();
    return true;
  }

  private recenterLive(uuid: string) {
    const index = this.order.indexOf(uuid);
    if (index < 0) return;
    const next = new Set<string>();
    [this.order[index - 1], uuid, this.order[index + 1]].forEach((u) => {
      if (u) next.add(u);
    });
    const changed =
      next.size !== this.liveUuids.size ||
      [...next].some((u) => !this.liveUuids.has(u));
    if (!changed) return;
    this.liveUuids = next;
    this.bump();
  }

  focusRelative = (
    uuid: string,
    direction: -1 | 1,
    where: 'start' | 'end',
  ) => {
    const index = this.order.indexOf(uuid);
    const target = this.order[index + direction];
    if (index < 0 || !target) return false;
    return this.focusPassage(target, where);
  };

  private focusEditor(editor: Editor, where: StackFocusTarget['where']) {
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
      const max = Selection.atEnd(editor.state.doc).from;
      editor.commands.focus(Math.max(1, Math.min(where, max)));
      return;
    }
    editor.commands.focus(where);
  }

  // ------------------------------------------------------ structural ops

  splitAtSelection = (uuid: string) => {
    const entry = this.entries.get(uuid);
    const editor = entry?.editor;
    const index = this.order.indexOf(uuid);
    if (!entry || !editor || index < 0) return false;

    const { doc, selection } = editor.state;
    const pos = selection.$from.pos;
    const beforeJSON = this.docJSONFromFragment(doc.content.cut(0, pos));
    const afterJSON = this.docJSONFromFragment(doc.content.cut(pos));

    const before = this.capture([uuid]);

    const newMeta: StackPassageMeta = {
      ...entry.meta,
      uuid: crypto.randomUUID(),
      sort: entry.meta.sort + 1,
      label: incrementLabel(entry.meta.label),
    };

    this.setDocContent(uuid, beforeJSON);
    this.createEntry(newMeta, afterJSON.content ?? []);
    this.order = [
      ...this.order.slice(0, index + 1),
      newMeta.uuid,
      ...this.order.slice(index + 1),
    ];
    this.normalizeLabelsFrom(index + 1);

    const after = this.capture([uuid, newMeta.uuid]);
    this.pushStructural({
      kind: 'structural',
      label: 'split',
      before,
      after,
      focusAfterUndo: { uuid, where: pos },
      focusAfterRedo: { uuid: newMeta.uuid, where: 'start' },
    });

    this.bump();
    this.focusPassage(newMeta.uuid, 'start');
    return true;
  };

  mergeWithPrevious = (uuid: string) => {
    const index = this.order.indexOf(uuid);
    if (index <= 0) return false;
    const prevUuid = this.order[index - 1];

    const prevJSON = this.getDocJSON(prevUuid);
    const currentJSON = this.getDocJSON(uuid);
    const boundary = this.docSize(prevJSON);

    const before = this.capture([prevUuid, uuid]);

    const merged: JSONContent = {
      type: 'doc',
      content: [
        ...(prevJSON.content ?? []),
        ...(currentJSON.content ?? []),
      ].filter(Boolean),
    };
    this.setDocContent(prevUuid, merged);
    this.order = this.order.filter((entryUuid) => entryUuid !== uuid);
    this.normalizeLabelsFrom(index - 1);

    const after = this.capture([prevUuid, uuid]);
    this.pushStructural({
      kind: 'structural',
      label: 'merge',
      before,
      after,
      focusAfterUndo: { uuid, where: 'start' },
      focusAfterRedo: { uuid: prevUuid, where: boundary },
    });

    this.bump();
    this.focusPassage(prevUuid, boundary);
    return true;
  };

  /**
   * Map a DOM point to a ProseMirror position, whether the passage is a
   * live editor (exact, via posAtDOM) or a static row (approximate, via the
   * text offset from the row start — inline atoms can skew it by a char).
   */
  resolvePoint = (uuid: string, node: Node, offset: number): number | null => {
    const editor = this.entries.get(uuid)?.editor;
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

  private posFromTextOffset(uuid: string, textOffset: number): number {
    const doc = this.pmDoc(this.getDocJSON(uuid));
    let remaining = textOffset;
    let pos: number | null = null;
    doc.descendants((node, nodePos) => {
      if (pos !== null) return false;
      if (node.isText) {
        const length = node.text?.length ?? 0;
        if (remaining <= length) {
          pos = nodePos + remaining;
          return false;
        }
        remaining -= length;
      }
      return true;
    });
    return pos ?? doc.content.size;
  }

  // ---------------------------------------------------- cross selection

  setCrossSelection(selection: StackCrossSelection | null) {
    this.crossSelection = selection;
  }

  hasCrossSelection = () => this.crossSelection !== null;

  /** Replace the cross-passage selection with pasted plain text. */
  pasteCrossSelection = (text: string) => this.deleteCrossSelection(text);

  deleteCrossSelection = (replaceWith?: string) => {
    const selection = this.crossSelection;
    if (!selection) return false;
    this.crossSelection = null;

    let { fromUuid, fromPos, toUuid, toPos } = selection;
    let fromIndex = this.order.indexOf(fromUuid);
    let toIndex = this.order.indexOf(toUuid);
    if (fromIndex < 0 || toIndex < 0) return false;
    if (fromIndex > toIndex) {
      [fromUuid, toUuid] = [toUuid, fromUuid];
      [fromPos, toPos] = [toPos, fromPos];
      [fromIndex, toIndex] = [toIndex, fromIndex];
    }

    const middles = this.order.slice(fromIndex + 1, toIndex);
    const affected = [fromUuid, ...middles, toUuid];
    const before = this.capture(affected);

    const fromDoc = this.pmDoc(this.getDocJSON(fromUuid));
    const toDoc = this.pmDoc(this.getDocJSON(toUuid));
    let fromJSON = this.docJSONFromFragment(fromDoc.content.cut(0, fromPos));
    if (replaceWith) {
      // Pasted text lands at the cut point — the end of the trimmed head.
      const trimmed = this.pmDoc(fromJSON);
      const transform = new Transform(trimmed);
      const insertPos = Selection.atEnd(trimmed).from;
      transform.replaceWith(
        insertPos,
        insertPos,
        this.schema.text(replaceWith),
      );
      fromJSON = transform.doc.toJSON();
    }
    this.setDocContent(fromUuid, fromJSON);
    this.setDocContent(
      toUuid,
      this.docJSONFromFragment(toDoc.content.cut(toPos)),
    );
    this.order = this.order.filter(
      (entryUuid) => !middles.includes(entryUuid),
    );
    this.normalizeLabelsFrom(fromIndex);

    const after = this.capture(affected);
    this.pushStructural({
      kind: 'structural',
      label: 'cross-delete',
      before,
      after,
      focusAfterUndo: { uuid: fromUuid, where: fromPos },
      focusAfterRedo: { uuid: fromUuid, where: 'end' },
    });

    window.getSelection()?.removeAllRanges();
    this.bump();
    this.focusPassage(fromUuid, 'end');
    return true;
  };

  // ------------------------------------------------------------ undo/redo

  undo = () => {
    while (this.undoLog.length) {
      const entry = this.undoLog.pop() as LogEntry;

      if (entry.kind === 'structural') {
        this.applyStructural(entry.before, entry.focusAfterUndo);
        this.redoLog.push(entry);
        return true;
      }

      const undoManager = this.entries.get(entry.uuid)?.undoManager;
      if (undoManager?.undoStack.length) {
        this.withSuppressedTextLog(() => undoManager.undo());
        this.redoLog.push(entry);
        this.focusPassage(entry.uuid, 'end');
        return true;
      }

      // Shouldn't happen now that managers outlive their editors; count it
      // in the HUD if it does.
      stackPerf.recordSkippedUndo();
    }
    return false;
  };

  redo = () => {
    while (this.redoLog.length) {
      const entry = this.redoLog.pop() as LogEntry;

      if (entry.kind === 'structural') {
        this.applyStructural(entry.after, entry.focusAfterRedo);
        this.undoLog.push(entry);
        return true;
      }

      const undoManager = this.entries.get(entry.uuid)?.undoManager;
      if (undoManager?.redoStack.length) {
        this.withSuppressedTextLog(() => undoManager.redo());
        this.undoLog.push(entry);
        this.focusPassage(entry.uuid, 'end');
        return true;
      }

      stackPerf.recordSkippedUndo();
    }
    return false;
  };

  undoDepth = () => this.undoLog.length;

  // -------------------------------------------------------------- private

  private materialize(uuid: string): StackEntry {
    const entry = this.entries.get(uuid);
    if (!entry) throw new Error(`unknown passage: ${uuid}`);
    if (entry.ydoc) return entry;

    entry.ydoc = new Doc();
    entry.fragment = entry.ydoc.getXmlFragment('content');
    const content = entry.seedContent?.length
      ? entry.seedContent
      : [EMPTY_PARAGRAPH];
    prosemirrorToYXmlFragment(
      this.pmDoc({ type: 'doc', content }),
      entry.fragment,
    );
    entry.seedContent = null;

    // Any fragment change — editor edits, structural ops, headless undo —
    // invalidates the passage's cached static HTML.
    entry.fragment.observeDeep(() => this.staticHTML.delete(uuid));

    // Created after seeding so the seed isn't undoable. Tracks only the
    // sync-plugin origin (user edits through a mounted editor); structural
    // ops use STRUCTURAL_ORIGIN and stay out of text history.
    const undoManager = new UndoManager(entry.fragment, {
      trackedOrigins: new Set([ySyncPluginKey]),
      deleteFilter: (item) => defaultDeleteFilter(item, defaultProtectedNodes),
      captureTransaction: (tr) => tr.meta.get('addToHistory') !== false,
    });
    // The undo plugin destroys whatever manager it is handed when its editor
    // unmounts; this one must outlive every mount, so neuter destroy.
    undoManager.destroy = () => undefined;
    undoManager.on(
      'stack-item-added',
      ({ type }: { type: 'undo' | 'redo' }) => {
        if (this.suppressTextLog || type !== 'undo') return;
        this.undoLog.push({ kind: 'text', uuid });
        this.redoLog = [];
      },
    );
    entry.undoManager = undoManager;
    return entry;
  }

  private createEntry(
    meta: StackPassageMeta,
    content: TranslationEditorContentItem[],
  ) {
    this.entries.set(meta.uuid, {
      meta,
      seedContent: content,
      charCount: JSON.stringify(content).length / 4,
      ydoc: null,
      fragment: null,
      editor: null,
      undoManager: null,
    });
  }

  private pmDoc(json: JSONContent): PMNode {
    try {
      return PMNode.fromJSON(this.schema, json);
    } catch (error) {
      console.error('failed to parse passage content', error);
      return PMNode.fromJSON(this.schema, {
        type: 'doc',
        content: [EMPTY_PARAGRAPH],
      });
    }
  }

  private docJSONFromFragment(fragment: {
    toJSON: () => JSONContent[] | null;
  }): JSONContent {
    const content = fragment.toJSON();
    return {
      type: 'doc',
      content: content?.length ? content : [EMPTY_PARAGRAPH],
    };
  }

  private docSize(json: JSONContent) {
    return this.pmDoc(json).content.size;
  }

  private getDocJSON(uuid: string): JSONContent {
    const entry = this.entries.get(uuid);
    if (!entry) return { type: 'doc', content: [EMPTY_PARAGRAPH] };
    if (entry.editor) return entry.editor.getJSON();
    if (entry.fragment) {
      return yXmlFragmentToProseMirrorRootNode(
        entry.fragment,
        this.schema,
      ).toJSON();
    }
    return {
      type: 'doc',
      content: entry.seedContent?.length
        ? (entry.seedContent as JSONContent[])
        : [EMPTY_PARAGRAPH],
    };
  }

  private setDocContent(uuid: string, json: JSONContent) {
    const entry = this.entries.get(uuid);
    if (!entry) return;
    // Materialized docs invalidate via the fragment observer; seed-only
    // entries have no observer yet.
    this.staticHTML.delete(uuid);

    if (!entry.ydoc || !entry.fragment) {
      entry.seedContent = (json.content ?? []) as TranslationEditorContentItem[];
      return;
    }

    const node = this.pmDoc(json);
    transact(
      entry.ydoc,
      () => {
        prosemirrorToYXmlFragment(node, entry.fragment as XmlFragment);
      },
      STRUCTURAL_ORIGIN,
    );
  }

  private capture(affectedUuids: string[]): StructuralState {
    return {
      order: [...this.order],
      metas: [...this.entries.entries()].map(([uuid, entry]) => [
        uuid,
        entry.meta,
      ]),
      docs: affectedUuids.map((uuid) => ({
        uuid,
        json: this.getDocJSON(uuid),
      })),
    };
  }

  private applyStructural(state: StructuralState, focus?: StackFocusTarget) {
    state.metas.forEach(([uuid, meta]) => {
      const entry = this.entries.get(uuid);
      if (entry) entry.meta = meta;
    });
    state.docs.forEach(({ uuid, json }) => this.setDocContent(uuid, json));
    this.order = [...state.order];
    this.bump();
    if (focus) this.focusPassage(focus.uuid, focus.where);
  }

  private pushStructural(entry: LogEntry) {
    this.undoLog.push(entry);
    this.redoLog = [];
  }

  private withSuppressedTextLog(fn: () => void) {
    this.suppressTextLog = true;
    try {
      fn();
    } finally {
      this.suppressTextLog = false;
    }
  }

  private normalizeLabelsFrom(anchorIndex: number) {
    const anchor = this.entries.get(this.order[anchorIndex])?.meta;
    if (!anchor?.label) return;

    const parts = anchor.label.split('.');
    const numParts = parts.length;
    const prefix =
      numParts > 1 ? parts.slice(0, -1).join('.') + '.' : '';

    let expected = incrementLabel(anchor.label);
    for (let i = anchorIndex + 1; i < this.order.length; i++) {
      const entry = this.entries.get(this.order[i]);
      const label = entry?.meta.label;
      if (!entry || !label) continue;

      const targetParts = label.split('.');
      if (targetParts.length < numParts) break;
      if (targetParts.length > numParts) continue;
      if (prefix && !label.startsWith(prefix)) break;
      if (label === expected) break;

      entry.meta = { ...entry.meta, label: expected };
      expected = incrementLabel(expected);
    }
  }

  private bump() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
}
