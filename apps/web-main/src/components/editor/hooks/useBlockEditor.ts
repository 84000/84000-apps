import { Content, useEditor, useEditorState } from '@tiptap/react';
import type { AnyExtension, Editor, EditorOptions } from '@tiptap/core';

import { ExtensionKit } from '@/extensions/extension-kit';

declare global {
  interface Window {
    editor: Editor | null;
  }
}

export const useBlockEditor = ({
  content,
  ...editorOptions
}: { content: Content } & Partial<Omit<EditorOptions, 'extensions'>>) => {
  const editor = useEditor(
    {
      ...editorOptions,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      autofocus: true,
      onCreate: (ctx) => {
        if (ctx.editor.isEmpty) {
          ctx.editor.commands.setContent(content);
          ctx.editor.commands.focus('start', { scrollIntoView: true });
        }
      },
      extensions: [...ExtensionKit()].filter(
        (e): e is AnyExtension => e !== undefined,
      ),
      editorProps: {
        attributes: {
          autocomplete: 'off',
          autocorrect: 'off',
          autocapitalize: 'off',
          class: 'min-h-full',
        },
      },
    },
    [],
  );

  const users = useEditorState({
    editor,
    selector: (ctx) => {
      // nothing to do yet
    },
  });

  window.editor = editor;

  return { editor, users };
};
