import { MarkViewContent, MarkViewProps } from '@tiptap/react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Skeleton,
} from '@design-system';
import { useCallback, useEffect, useState } from 'react';
import { GlossaryTermInstance } from '@data-access';
import { useSearchParams } from 'next/navigation';
import { GlossaryInstanceBody } from '../../../shared';

export const GlossaryInstanceCard = ({
  uuid,
  fetch,
}: {
  uuid: string;
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

  if (!content) {
    return <Skeleton className="p-2 h-20 w-full" />;
  }

  return <GlossaryInstanceBody instance={content} />;
};

export const GlossaryInstance = ({ mark, extension }: MarkViewProps) => {
  const searchParams = useSearchParams();

  const fetch = extension.options.fetch as (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;

  const onClick = useCallback(() => {
    if (!mark.attrs.glossary) {
      return;
    }

    const query = new URLSearchParams(searchParams?.toString());
    query.set('right', 'open:glossary');
    window.history.pushState(
      {},
      '',
      `?${query.toString()}#${mark.attrs.glossary}`,
    );
  }, [mark, searchParams]);

  return (
    <HoverCard>
      <HoverCardTrigger>
        <MarkViewContent
          as="span"
          onClick={onClick}
          {...extension.options.HTMLAttributes}
        />
      </HoverCardTrigger>
      <HoverCardContent className="w-120 lg:w-4xl max-h-100 m-2 overflow-auto">
        <GlossaryInstanceCard uuid={mark.attrs.glossary} fetch={fetch} />
      </HoverCardContent>
    </HoverCard>
  );
};
