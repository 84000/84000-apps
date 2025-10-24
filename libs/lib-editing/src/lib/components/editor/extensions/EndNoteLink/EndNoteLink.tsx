'use client';

import { Skeleton } from '@design-system';
import { useEffect, useState } from 'react';
import TranslationEditor, {
  TranslationEditorContent,
} from '../../TranslationEditor';
import { TranslationHoverCard } from '../TranslationHoverCard';

export const EndNoteLink = ({
  uuid,
  fetch,
  setCard,
  anchor,
}: {
  uuid: string;
  anchor: HTMLElement;
  fetch?: (uuid: string) => Promise<TranslationEditorContent | undefined>;
  setCard: (card: HTMLElement | null) => void;
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

  return (
    <TranslationHoverCard
      anchor={anchor}
      setCard={setCard}
      className="w-120 max-h-96 m-2 overflow-auto"
    >
      {content ? (
        <div className="p-2">
          <TranslationEditor content={content} isEditable={false} />
        </div>
      ) : (
        <Skeleton className="p-2 h-20 w-full" />
      )}
    </TranslationHoverCard>
  );
};

export default EndNoteLink;
