import { Extension } from '@tiptap/core';
import { Editor } from '@tiptap/react';
import { Selection } from '@tiptap/pm/state';
import type { StackKeyboardDelegate } from './types';

type BoundaryKeymapOptions = {
  uuid: string;
  delegate: StackKeyboardDelegate;
};

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
        if (!editor.state.selection.empty) return false;
        if (!inFirstTopBlock(editor)) return false;
        if (!editor.view.endOfTextblock('up')) return false;
        return delegate.focusRelative(uuid, -1, 'end');
      },
      ArrowDown: ({ editor }) => {
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
        if (!atDocEnd(editor)) return false;
        return delegate.splitAtSelection(uuid);
      },
      'Mod-Enter': () => delegate.splitAtSelection(uuid),
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
