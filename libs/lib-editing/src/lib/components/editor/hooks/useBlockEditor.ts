'use client';

import {
  Content,
  Editor,
  Extensions,
  UseEditorOptions,
  useEditor,
} from '@tiptap/react';
declare global {
  interface Window {
    editor: Editor | null;
  }
}

export const useBlockEditor = ({
  content,
  extensions = [],
  isEditable = true,
  // Off by default: multiple editors mount simultaneously (front,
  // translation, endnotes, abbreviations) and each grabbing focus scrolls
  // its container — last mount wins and the viewport jumps. Only the
  // primary editor should opt in.
  autofocus = false,
  undoableInitialContent = true,
  onCreate,
  ...rest
}: UseEditorOptions & {
  content: Content;
  extensions?: Extensions;
  isEditable?: boolean;
  autofocus?: boolean;
  /**
   * Whether undo can take the editor back past the content it loaded with,
   * to an empty document.
   */
  undoableInitialContent?: boolean;
}) => {
  const editor = useEditor({
    extensions,
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    autofocus: autofocus ? 'start' : false,
    editable: isEditable,
    editorProps: {
      attributes: {
        spellcheck: 'false',
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        class: 'min-h-full focus:outline-none',
        translate: isEditable ? 'no' : 'yes',
      },
    },
    onCreate: (ctx) => {
      if (ctx.editor.isEmpty) {
        if (undoableInitialContent) {
          ctx.editor.commands.setContent(content);
        } else {
          // Loading is not an edit: neither undoable nor reported as one.
          ctx.editor
            .chain()
            .setMeta('addToHistory', false)
            .setContent(content, { emitUpdate: false })
            .run();
        }
        if (autofocus) {
          ctx.editor.commands.focus('start', { scrollIntoView: true });
        }
      }
      onCreate?.(ctx);
    },
    ...rest,
  });

  return { editor };
};
