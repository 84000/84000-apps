import { Skeleton } from '@design-system';
import { useEffect, useState } from 'react';
import { GlossaryTermInstance } from '@data-access';
import { GlossaryInstanceBody } from '../../../shared';

export const GlossaryInstance = ({
  uuid,
  fetch,
}: {
  uuid: string;
  fetch?: (uuid: string) => Promise<GlossaryTermInstance | undefined>;
}) => {
  const [content, setContent] = useState<GlossaryTermInstance>();

  useEffect(() => {
    if (!uuid || !fetch) {
      return;
    }

    (async () => {
      const res = await fetch?.(uuid);
      setContent(res);
    })();
  }, [uuid, fetch]);

  return content ? (
    <GlossaryInstanceBody instance={content} />
  ) : (
    <Skeleton className="p-2 h-20 w-full" />
  );
};
