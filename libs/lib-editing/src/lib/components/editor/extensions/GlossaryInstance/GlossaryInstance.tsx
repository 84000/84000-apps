import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Skeleton,
} from '@design-system';
import { useCallback, useEffect, useState } from 'react';
import { GlossaryTermInstance } from '@data-access';
import { useSearchParams } from 'next/navigation';
import { validateAttrs } from '../../util';
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

export const GlossaryInstance = ({
  node,
  extension,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) => {
  const searchParams = useSearchParams();

  const fetch = extension.options.fetch as (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;

  useEffect(() => {
    validateAttrs({ node, editor, getPos, updateAttributes });
  }, [node, editor, getPos, updateAttributes]);

  const onClick = useCallback(() => {
    if (!node.attrs.glossary) {
      return;
    }

    const query = new URLSearchParams(searchParams?.toString());
    query.set('right', 'open:glossary');
    window.location.hash = node.attrs.glossary;
    window.history.pushState({}, '', `?${query.toString()}`);
  }, [node, searchParams]);

  return (
    <NodeViewWrapper as="span">
      <HoverCard>
        <HoverCardTrigger>
          <NodeViewContent
            as="span"
            onClick={onClick}
            {...extension.options.HTMLAttributes}
          />
        </HoverCardTrigger>
        <HoverCardContent className="w-120 lg:w-4xl max-h-100 m-2 overflow-auto">
          <GlossaryInstanceCard uuid={node.attrs.glossary} fetch={fetch} />
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  );
};
