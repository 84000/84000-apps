import { Skeleton } from '@design-system';
import { useEffect, useState } from 'react';
import { GlossaryTermInstance } from '@data-access';
import { GlossaryInstanceBody } from '../../../shared';
import { TranslationHoverCard } from '../TranslationHoverCard';

export const GlossaryInstance = ({
  uuid,
  fetch,
  anchor,
  setCard,
}: {
  uuid: string;
  anchor: HTMLElement;
  setCard: (card: HTMLElement | null) => void;
  fetch?: (uuid: string) => Promise<GlossaryTermInstance | undefined>;
}) => {
  const [content, setContent] = useState<GlossaryTermInstance>();

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
      className="w-120 lg:w-4xl max-h-100 m-2 overflow-auto"
      anchor={anchor}
      setCard={setCard}
    >
      {content ? (
        <GlossaryInstanceBody instance={content} />
      ) : (
        <Skeleton className="p-2 h-20 w-full" />
      )}
    </TranslationHoverCard>
  );
};
