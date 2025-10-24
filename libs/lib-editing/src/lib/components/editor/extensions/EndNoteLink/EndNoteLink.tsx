'use client';

import { Skeleton } from '@design-system';
import { useEffect, useState } from 'react';
import TranslationEditor, {
  TranslationEditorContent,
} from '../../TranslationEditor';

export const EndNoteLink = ({
  uuid,
  fetch,
}: {
  uuid: string;
  fetch?: (uuid: string) => Promise<TranslationEditorContent | undefined>;
}) => {
  const [content, setContent] = useState<TranslationEditorContent>();

  useEffect(() => {
    if (!uuid || content || !fetch) {
      return;
    }

    (async () => {
      const res = await fetch?.(uuid);
      setContent(res);
    })();
  }, [uuid, content, fetch]);

  return content ? (
    <div className="p-2">
      <TranslationEditor content={content} isEditable={false} />
    </div>
  ) : (
    <Skeleton className="p-2 h-20 w-full" />
  );
};

export default EndNoteLink;
