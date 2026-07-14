import {
  Editor,
  Extensions,
  JSONContent,
  getSchema,
} from '@tiptap/core';
import { Node as PMNode, Schema } from '@tiptap/pm/model';
import { Selection } from '@tiptap/pm/state';
import { Doc, XmlFragment, transact } from 'yjs';
import {
  prosemirrorToYXmlFragment,
  yXmlFragmentToProseMirrorRootNode,
} from 'y-prosemirror';
import { renderToHTMLString } from '@tiptap/static-renderer/pm/html-string';
import { yUndoPluginKey } from '@tiptap/y-tiptap';
import type { TranslationEditorContentItem } from '@eightyfourthousand/data-access';

import { incrementLabel } from '../editor/extensions/Passage/label';
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
  unsubscribeUndo: (() => void) | null;
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
  private scrollToIndex: ((index: number) => void) | null = null;

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
        unsubscribeUndo: null,
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
      delegate: this,
    });
  }

  registerEditor(uuid: string, editor: Editor) {
    const entry = this.entries.get(uuid);
    if (!entry) return;

    entry.editor = editor;

    // Invalidate eagerly on each edit — a row can swap from editor to static
    // within a single commit, and the swap must never render stale HTML.
    editor.on('update', () => this.staticHTML.delete(uuid));

    const undoManager = yUndoPluginKey.getState(editor.state)?.undoManager;
    if (undoManager) {
      // Init-time normalization transactions (trailing node, uuid dedupe)
      // land in the fresh UndoManager during mount. They aren't user edits;
      // left in place they become phantom undo entries that Mod-Z replays.
      // Some fire a tick after onCreate, so clear again and only then start
      // feeding the command log.
      undoManager.clear();
      const onStackItemAdded = ({ type }: { type: 'undo' | 'redo' }) => {
        if (this.suppressTextLog || type !== 'undo') return;
        this.undoLog.push({ kind: 'text', uuid });
        this.redoLog = [];
      };
      const timer = setTimeout(() => {
        undoManager.clear();
        undoManager.on('stack-item-added', onStackItemAdded);
      }, 0);
      entry.unsubscribeUndo = () => {
        clearTimeout(timer);
        undoManager.off('stack-item-added', onStackItemAdded);
      };
    }

    if (this.pendingFocus?.uuid === uuid) {
      const { where } = this.pendingFocus;
      this.pendingFocus = null;
      this.focusEditor(editor, where);
    }
  }

  unregisterEditor(uuid: string) {
    const entry = this.entries.get(uuid);
    if (!entry) return;
    entry.unsubscribeUndo?.();
    entry.unsubscribeUndo = null;
    entry.editor = null;
    // The editor may have changed the doc; regenerate on next static render.
    this.staticHTML.delete(uuid);
  }

  getEditor = (uuid: string) => this.entries.get(uuid)?.editor ?? null;

  setScrollHandler(handler: ((index: number) => void) | null) {
    this.scrollToIndex = handler;
  }

  // --------------------------------------------------------------- focus

  focusPassage(uuid: string, where: StackFocusTarget['where'] = 'start') {
    const entry = this.entries.get(uuid);
    const index = this.order.indexOf(uuid);
    if (!entry || index < 0) return false;

    if (entry.editor) {
      this.focusEditor(entry.editor, where);
      this.scrollToIndex?.(index);
      return true;
    }

    this.pendingFocus = { uuid, where };
    this.scrollToIndex?.(index);
    // The target row may be static with no scroll movement coming (e.g. a
    // click during the settle window) — re-render so it swaps to an editor.
    this.bump();
    return true;
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

  // ---------------------------------------------------- cross selection

  setCrossSelection(selection: StackCrossSelection | null) {
    this.crossSelection = selection;
  }

  hasCrossSelection = () => this.crossSelection !== null;

  deleteCrossSelection = () => {
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
    this.setDocContent(
      fromUuid,
      this.docJSONFromFragment(fromDoc.content.cut(0, fromPos)),
    );
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

      const editor = this.entries.get(entry.uuid)?.editor;
      const undoManager = editor
        ? yUndoPluginKey.getState(editor.state)?.undoManager
        : null;
      if (undoManager?.undoStack.length) {
        this.withSuppressedTextLog(() => undoManager.undo());
        this.redoLog.push(entry);
        this.focusPassage(entry.uuid, 'end');
        return true;
      }

      // The passage's editor unmounted and took its text history with it —
      // drop the entry and surface the loss in the HUD.
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

      const editor = this.entries.get(entry.uuid)?.editor;
      const undoManager = editor
        ? yUndoPluginKey.getState(editor.state)?.undoManager
        : null;
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
      unsubscribeUndo: null,
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
