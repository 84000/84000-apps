import type { JSONContent } from '@tiptap/core';
import type { Node as PMNode } from '@tiptap/pm/model';
import type {
  PassageMeta,
  WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import {
  passagesFromHTML,
  passagesFromText,
  passagesToHTML,
  passagesToText,
} from './stack-clipboard';
import type { StackFocusWhere, StackPassageSelection } from './types';

/**
 * A stack view's selection of whole passages, and the clipboard and delete
 * operations over it.
 */
export class StackPassageSelectionModel {
  private readonly work: WorkDocument;
  private readonly getOrder: () => string[];
  private readonly getMeta: (uuid: string) => PassageMeta | null;
  private readonly focusPassage: (
    uuid: string,
    where: StackFocusWhere,
  ) => boolean;
  private readonly blurEditors: () => void;
  private readonly bump: () => void;

  private passageSelection: StackPassageSelection | null = null;

  constructor(host: {
    work: WorkDocument;
    getOrder: () => string[];
    getMeta: (uuid: string) => PassageMeta | null;
    focusPassage: (uuid: string, where: StackFocusWhere) => boolean;
    blurEditors: () => void;
    bump: () => void;
  }) {
    this.work = host.work;
    this.getOrder = host.getOrder;
    this.getMeta = host.getMeta;
    this.focusPassage = host.focusPassage;
    this.blurEditors = host.blurEditors;
    this.bump = host.bump;
  }

  /**
   * Select whole passages from `anchorUuid` through `focusUuid`.
   *
   * Passages rather than a character range: each row is its own editor, and a
   * browser keeps a selection that begins inside one `contenteditable` inside
   * it, so a partial range spanning rows cannot be acquired by dragging in the
   * first place. The passage is the unit the spine, the save and undo already
   * work in, so it is the unit here too.
   */
  setPassageSelection(anchorUuid: string, focusUuid: string) {
    const order = this.getOrder();
    if (order.indexOf(anchorUuid) < 0 || order.indexOf(focusUuid) < 0) return;
    const next = { anchorUuid, focusUuid };
    if (
      this.passageSelection?.anchorUuid === anchorUuid &&
      this.passageSelection?.focusUuid === focusUuid
    ) {
      return;
    }
    this.passageSelection = next;
    // The selection now belongs to the stack, not to any editor: leave a live
    // one holding a caret and the next keystroke would go to it, and leave the
    // browser's own selection standing and two highlights are drawn at once.
    this.blurEditors();
    window.getSelection()?.removeAllRanges();
    this.bump();
  }

  clearPassageSelection() {
    if (!this.passageSelection) return;
    this.passageSelection = null;
    this.bump();
  }

  hasPassageSelection = () => this.passageSelection !== null;

  isSelected = (uuid: string) => this.selectedUuids().includes(uuid);

  /** The selected passages, in spine order. */
  selectedUuids = (): string[] => {
    const selection = this.passageSelection;
    if (!selection) return [];
    const order = this.getOrder();
    const from = order.indexOf(selection.anchorUuid);
    const to = order.indexOf(selection.focusUuid);
    if (from < 0 || to < 0) return [];
    return order.slice(Math.min(from, to), Math.max(from, to) + 1);
  };

  /**
   * What a passage selection puts on the clipboard.
   *
   * Null when any selected passage has no document in memory: a passage
   * outside the hydration window has nothing to serialize, and a copy that
   * silently skipped it would lose content the selection covered.
   */
  serializePassageSelection = (): { text: string; html: string } | null => {
    const uuids = this.selectedUuids();
    if (!uuids.length) return null;

    const nodes: PMNode[] = [];
    for (const uuid of uuids) {
      const doc = this.work.store.peek(uuid);
      if (!doc) return null;
      nodes.push(doc.toNode());
    }

    return {
      text: passagesToText(nodes),
      html: passagesToHTML(this.work.schema, nodes),
    };
  };

  /** Delete the selected passages, as one command. */
  deletePassageSelection = () => this.replacePassageSelection();

  /** Replace the selected passages with what the clipboard carries. */
  pastePassageSelection = ({ html, text }: { html: string; text: string }) => {
    const blocks = passagesFromHTML(this.work.schema, html);
    return this.replacePassageSelection(
      blocks.length ? blocks : passagesFromText(text),
    );
  };

  private replacePassageSelection(passages: JSONContent[][] = []) {
    const uuids = this.selectedUuids();
    if (!uuids.length) return false;

    const at = this.getOrder().indexOf(uuids[0]);
    const meta = this.getMeta(uuids[0]);
    this.passageSelection = null;

    const replaced = this.work.replacePassages(
      uuids,
      passages.map((content) => ({
        type: meta?.type ?? 'translation',
        toh: meta?.toh,
        content,
      })),
    );
    if (!replaced) return false;

    window.getSelection()?.removeAllRanges();
    // Whatever now stands where the selection was: the first pasted passage,
    // or the row that closed the gap a delete left.
    const order = this.getOrder();
    const next = order[Math.min(at, order.length - 1)];
    if (next) this.focusPassage(next, 'start');
    return true;
  }
}
