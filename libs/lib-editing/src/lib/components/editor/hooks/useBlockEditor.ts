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
  onCreate,
  ...rest
}: UseEditorOptions & {
  content: Content;
  extensions?: Extensions;
  isEditable?: boolean;
  autofocus?: boolean;
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
        ctx.editor.commands.setContent(content);
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
