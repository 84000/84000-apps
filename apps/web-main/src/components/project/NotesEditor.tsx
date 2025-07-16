import { BlockEditor } from '@design-system';
import { EditorEvents, JSONContent } from '@tiptap/react';
import { useCallback, useEffect, useState } from 'react';

export const NotesEditor = ({
  notes,
  isEditable,
  onChange,
  isDirty,
}: {
  notes: string;
  isEditable: boolean;
  onChange?: (notes: string) => void;
  isDirty?: (isDirty: boolean) => void;
}) => {
  const [content, setContent] = useState<JSONContent>({});

  useEffect(() => {
    try {
      const doc = JSON.parse(notes);
      setContent(doc);
    } catch (error) {
      // if notes are a string, massage it into a document
      const doc = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: notes,
              },
            ],
          },
        ],
      };
      setContent(doc);
    }
  }, [notes]);

  const onUpdate = useCallback(
    ({ editor }: EditorEvents['update']) => {
      const newContentJson = editor.getJSON();
      const newContent = JSON.stringify(newContentJson);
      const isContentDirty = newContent !== notes;
      isDirty?.(isContentDirty);
      if (isContentDirty) {
        onChange?.(newContent);
      }
    },
    [notes, onChange, isDirty],
  );

  return (
    <BlockEditor
      content={content}
      isEditable={isEditable}
      onUpdate={onUpdate}
    />
  );
};
