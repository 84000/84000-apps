import { Extension } from '@tiptap/core';
import { Editor } from '@tiptap/react';
import {
  type EditorState,
  Selection,
  TextSelection,
  type Transaction,
} from '@tiptap/pm/state';
import { slashCommandPluginKey } from '../editor/extensions/SlashCommand/SlashCommand';
import { mentionSuggestionPluginKey } from '../editor/extensions/Mention/MentionSuggestion';
import type { StackKeyboardDelegate } from './types';

type BoundaryKeymapOptions = {
  uuid: string;
  delegate: StackKeyboardDelegate;
  /** Whether Enter and Backspace may split and merge rows. */
  restructure: boolean;
  /** Whether the row is one line, so Enter adds none. */
  singleLine: boolean;
};

/**
 * Whether a suggestion menu is open in this editor.
 *
 * The slash and mention menus drive themselves with Enter and the arrow keys,
 * and this extension runs at priority 1000 — ahead of them. Without this guard
 * Enter on an open slash menu splits the passage instead of choosing the
 * highlighted item, leaving the `/passage` trigger text behind in the head, and
 * the arrows move focus to the next passage instead of down the menu.
 *
 * Production has no boundary keymap, so the conflict is specific to the stack.
 */
const suggestionOpen = (editor: Editor) =>
  [slashCommandPluginKey, mentionSuggestionPluginKey].some(
    (key) =>
      (key.getState(editor.state) as { active?: boolean } | undefined)
        ?.active === true,
  );

const atDocStart = (editor: Editor) => {
  const { selection, doc } = editor.state;
  return selection.empty && selection.$from.pos === Selection.atStart(doc).from;
};

const atDocEnd = (editor: Editor) => {
  const { selection, doc } = editor.state;
  return selection.empty && selection.$from.pos === Selection.atEnd(doc).from;
};

const inFirstTopBlock = (editor: Editor) =>
  editor.state.selection.$from.index(0) === 0;

const inLastTopBlock = (editor: Editor) => {
  const { $from } = editor.state.selection;
  return $from.index(0) === editor.state.doc.childCount - 1;
};

/**
 * Where a second Enter at the end of a passage splits it, and the edit that
 * gets the passage ready to split there — or null when this Enter is not that
 * gesture.
 *
 * "A second Enter" is the caret in an empty block at the very end of the
 * passage, with something before it: the first Enter made that block. Requiring
 * something before it means an Enter in an empty passage makes a block first
 * too, so the gesture is always two presses rather than one here and two there.
 *
 * The split goes *between* top-level blocks, so the empty block moves to the
 * new passage and the head does not end in a blank line. A paragraph is
 * already a top-level block. A line is not: the first Enter in a line group
 * adds another line to the group (nothing lifts an empty line out, the way a
 * list lifts an empty item), so splitting at the caret would only start a new
 * passage that is itself a line group. The empty line comes out of the group
 * and the new passage starts with a paragraph instead.
 *
 * Other containers — lists, blockquotes, tables — keep their own Enter: their
 * keymaps lift an empty item out, and the Enter after that is the paragraph
 * case.
 */
export const secondEnterSplit = (
  state: EditorState,
): { at: number; tr: Transaction | null } | null => {
  const { selection, doc } = state;
  const { $from } = selection;
  const block = $from.parent;
  if (!selection.empty || !block.isTextblock || block.content.size > 0) {
    return null;
  }
  if ($from.pos !== Selection.atEnd(doc).from) return null;

  let preceded = false;
  for (let depth = 0; depth < $from.depth; depth++) {
    if ($from.index(depth) > 0) preceded = true;
  }
  if (!preceded) return null;

  if ($from.depth === 1) {
    return { at: $from.before(1), tr: null };
  }

  const group = $from.node(1);
  if ($from.depth !== 2 || group.type.name !== 'lineGroup') return null;

  // The group's only line goes with the group; an empty group is invalid.
  const tr = state.tr;
  if (group.childCount > 1) tr.delete($from.before(2), $from.after(2));
  else tr.delete($from.before(1), $from.after(1));

  const paragraph = doc.type.contentMatch.defaultType?.createAndFill();
  if (!paragraph) return null;
  const at = tr.doc.content.size;
  tr.insert(at, paragraph);
  tr.setSelection(TextSelection.create(tr.doc, at + 1));
  return { at, tr };
};

/**
 * Routes keys that cross passage boundaries — caret navigation, a second Enter
 * at the end (new passage), Backspace at the start (merge) — and global
 * undo/redo to the stack controller. High priority so it runs before
 * Collaboration's per-document Mod-z, which must not bypass the stack-wide
 * command log.
 */
export const BoundaryKeymap = Extension.create<BoundaryKeymapOptions>({
  name: 'boundaryKeymap',
  priority: 1000,

  addOptions() {
    return {
      uuid: '',
      delegate: null as unknown as StackKeyboardDelegate,
      restructure: true,
      singleLine: false,
    };
  },

  addKeyboardShortcuts() {
    const {
      uuid,
      delegate,
      restructure = true,
      singleLine = false,
    } = this.options;

    return {
      ArrowUp: ({ editor }) => {
        if (suggestionOpen(editor)) return false;
        if (!editor.state.selection.empty) return false;
        if (!inFirstTopBlock(editor)) return false;
        if (!editor.view.endOfTextblock('up')) return false;
        return delegate.focusRelative(uuid, -1, 'end');
      },
      ArrowDown: ({ editor }) => {
        if (suggestionOpen(editor)) return false;
        if (!editor.state.selection.empty) return false;
        if (!inLastTopBlock(editor)) return false;
        if (!editor.view.endOfTextblock('down')) return false;
        return delegate.focusRelative(uuid, 1, 'start');
      },
      ArrowLeft: ({ editor }) => {
        if (!atDocStart(editor)) return false;
        return delegate.focusRelative(uuid, -1, 'end');
      },
      ArrowRight: ({ editor }) => {
        if (!atDocEnd(editor)) return false;
        return delegate.focusRelative(uuid, 1, 'start');
      },
      Enter: ({ editor }) => {
        if (suggestionOpen(editor)) return false;
        // One line: Enter starts the row after it, if rows can be started.
        if (singleLine)
          return restructure ? delegate.splitAtSelection(uuid) : true;
        if (!restructure) return false;

        // A single Enter belongs to the paragraph, not to the passage: at the
        // end of a passage it should do what it does everywhere else and start
        // a new block. Only a second one — the caret sitting in the empty
        // block the first made — starts a new passage, which is also what the
        // slash menu's Passage item does directly.
        const split = secondEnterSplit(editor.state);
        if (!split) return false;
        if (split.tr) editor.view.dispatch(split.tr);
        return delegate.splitAtSelection(uuid, split.at);
      },
      'Mod-Enter': ({ editor }) =>
        restructure && !suggestionOpen(editor)
          ? delegate.splitAtSelection(uuid)
          : singleLine,
      Backspace: ({ editor }) => {
        // A selection is the default's business: it deletes it.
        if (!editor.state.selection.empty) return false;

        if (atDocStart(editor)) {
          return restructure ? delegate.mergeWithPrevious(uuid) : true;
        }

        // Inside the passage, and not at the start of a block: an ordinary
        // character delete.
        if (!editor.view.endOfTextblock('backward')) return false;

        // At the start of a block with something before it. ProseMirror tries
        // `joinBackward` and, when the preceding block will not take the
        // content — a heading, a table, a line group — falls through to
        // `selectNodeBackward`, which selects that whole block. That is what
        // put the bubble menu over a merged passage and made the next
        // Backspace delete the block outright. Join when a join is possible,
        // and otherwise do nothing.
        editor.commands.joinBackward();
        return true;
      },
      // Swallow even when there is nothing to undo — falling through would
      // run Collaboration's per-document undo and desync the command log.
      'Mod-z': () => {
        delegate.undo();
        return true;
      },
      'Shift-Mod-z': () => {
        delegate.redo();
        return true;
      },
      'Mod-y': () => {
        delegate.redo();
        return true;
      },
    };
  },
});
