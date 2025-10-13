'use client';

import { GlossaryPageItem } from '@data-access';
import { BlockEditor } from '@lib-editing';
import { EditorEvents } from '@tiptap/react';
import { useCallback, useState } from 'react';

export const GlossaryEditor = ({
  detail,
  isEditable = false,
}: {
  detail: GlossaryPageItem;
  isEditable?: boolean;
}) => {
  const [content, setContent] = useState(detail.definition || '');

  const onUpdate = useCallback(({ editor }: EditorEvents['update']) => {
    const newContentJson = editor.getHTML();
    const newContent = JSON.stringify(newContentJson);
    setContent(newContent);
  }, []);

  if (!detail.definition) {
    return null;
  }

  return (
    <div className="py-4">
      <BlockEditor
        content={content}
        isEditable={isEditable}
        onUpdate={onUpdate}
      />
    </div>
  );
};
