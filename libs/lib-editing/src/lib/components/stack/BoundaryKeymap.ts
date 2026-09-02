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
 * Routes keys that cross passage boundaries — caret navigation, Enter at the
 * end (new passage), Backspace at the start (merge) — and global undo/redo to
 * the stack controller. High priority so it runs before Collaboration's
 * per-document Mod-z, which must not bypass the stack-wide command log.
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
        return delegate.splitAtSelection(uuid);
      },
      'Mod-Enter': ({ editor }) =>
        suggestionOpen(editor) ? false : delegate.splitAtSelection(uuid),
      Backspace: ({ editor }) => {
        if (!atDocStart(editor)) return false;
        return delegate.mergeWithPrevious(uuid);
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
