import { Content, Editor, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

declare global {
  interface Window {
    editor: Editor | null;
  }
}

export const useBlockEditor = ({ content }: { content: Content }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    immediatelyRender: true,
    shouldRerenderOnTransaction: false,
    autofocus: true,
    editorProps: {
      attributes: {
        autocomplete: 'off',
        autocorrect: 'off',
        autocapitalize: 'off',
        class: 'min-h-full',
      },
    },
    onCreate: (ctx) => {
      if (ctx.editor.isEmpty) {
        ctx.editor.commands.setContent(content);
        ctx.editor.commands.focus('start', { scrollIntoView: true });
      }
    },
  });

  return { editor };
};
