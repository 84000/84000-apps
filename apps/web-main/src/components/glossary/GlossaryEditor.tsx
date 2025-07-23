'use client';

import { GlossaryPageItem } from '@data-access';
import { GlossaryEditor } from '@design-system';
import { EditorEvents } from '@tiptap/react';
import { useCallback, useState } from 'react';

export const GlossaryEntryEditor = ({
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
      <GlossaryEditor
        content={content}
        isEditable={isEditable}
        onUpdate={onUpdate}
      />
    </div>
  );
};
