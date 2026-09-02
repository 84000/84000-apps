import { Extension } from '@tiptap/core';
import { Editor } from '@tiptap/react';
import { Selection } from '@tiptap/pm/state';
import { slashCommandPluginKey } from '../editor/extensions/SlashCommand/SlashCommand';
import { mentionSuggestionPluginKey } from '../editor/extensions/Mention/MentionSuggestion';
import type { StackKeyboardDelegate } from './types';

type BoundaryKeymapOptions = {
  uuid: string;
  delegate: StackKeyboardDelegate;
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
 * Whether the caret sits in an empty last block that is not the only block.
 *
 * This is what "a second Enter" looks like: the first one made an empty
 * paragraph at the end of the passage, and the caret is now in it. Requiring
 * more than one block means an Enter in an empty passage makes a paragraph
 * first too, so the gesture is always two presses rather than one here and two
 * there.
 */
const inEmptyTrailingBlock = (editor: Editor) => {
  const { doc } = editor.state;
  if (doc.childCount < 2) return false;
  const last = doc.child(doc.childCount - 1);
  return last.isTextblock && last.content.size === 0 && inLastTopBlock(editor);
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
    };
  },

  addKeyboardShortcuts() {
    const { uuid, delegate } = this.options;

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
        if (!atDocEnd(editor)) return false;

        // A single Enter belongs to the paragraph, not to the passage: at the
        // end of a passage it should do what it does everywhere else and start
        // a new block. Only a second one — the caret sitting in the empty
        // paragraph the first made — starts a new passage, which is also what
        // the slash menu's Passage item does directly.
        if (!inEmptyTrailingBlock(editor)) return false;

        // Drop the empty paragraph before splitting, or the head would keep it
        // and the passage would end in a blank line.
        editor.chain().deleteCurrentNode().run();
        return delegate.splitAtSelection(uuid);
      },
      'Mod-Enter': ({ editor }) =>
        suggestionOpen(editor) ? false : delegate.splitAtSelection(uuid),
      Backspace: ({ editor }) => {
        // A selection is the default's business: it deletes it.
        if (!editor.state.selection.empty) return false;

        if (atDocStart(editor)) return delegate.mergeWithPrevious(uuid);

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
