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
  onCreate,
  ...rest
}: UseEditorOptions & {
  content: Content;
  extensions?: Extensions;
  isEditable?: boolean;
}) => {
  const editor = useEditor({
    extensions,
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    autofocus: true,
    editable: isEditable,
    editorProps: {
      attributes: {
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        class: 'min-h-full focus:outline-none',
      },
    },
    onCreate: (ctx) => {
      if (ctx.editor.isEmpty) {
        ctx.editor.commands.setContent(content);
        ctx.editor.commands.focus('start', { scrollIntoView: true });
      }
      onCreate?.(ctx);
    },
    ...rest,
  });

  return { editor };
};
