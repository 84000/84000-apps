'use client';

import { EditorContent } from '@tiptap/react';
import { useBlockEditor } from './hooks/useBlockEditor';

export const BlockEditor = () => {
  const { editor } = useBlockEditor({
    content: {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [
            {
              type: 'text',
              text: 'A heading',
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'A line of text',
            },
          ],
        },
      ],
    },
  });
  return (
    <div className="flex h-full">
      <div className="relative flex flex-col flex-1 h-full overflow-hidden">
        <EditorContent className="flex-1 overflow-y-auto" editor={editor} />
      </div>
    </div>
  );
};

export default BlockEditor;
