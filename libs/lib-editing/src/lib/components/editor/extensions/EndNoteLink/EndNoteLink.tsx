'use client';

import { Skeleton } from '@84000/design-system';
import { useEffect, useState } from 'react';
import { Passage } from '@84000/data-access';
import { LabeledElement } from '../../../shared';

export const EndNoteLink = ({
  uuid,
  fetch,
}: {
  uuid: string;
  fetch?: (uuid: string) => Promise<Passage | undefined>;
}) => {
  const [content, setContent] = useState<Passage>();

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
    <div className="p-2">
      <LabeledElement label={content.label} contentType="endnotes">
        {content.content}
      </LabeledElement>
    </div>
  ) : (
    <Skeleton className="p-2 h-20 w-full" />
  );
};

export default EndNoteLink;
