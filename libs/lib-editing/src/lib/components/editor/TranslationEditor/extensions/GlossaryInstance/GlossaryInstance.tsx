import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Skeleton,
} from '@design-system';
import { useEffect, useState } from 'react';

export const GlossaryInsanceCard = ({
  uuid,
  fetch,
}: {
  uuid: string;
  fetch?: (uuid: string) => Promise<Record<string, string> | undefined>;
}) => {
  const [content, setContent] = useState<Record<string, string>>();

  useEffect(() => {
    if (!uuid || content) {
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

  return <div className="p-2">This is a glossary instance.</div>;
};

export const GlossaryInstance = ({ node, extension }: NodeViewProps) => {
  const fetch = extension.options.fetch as (
    uuid: string,
  ) => Promise<Record<string, string> | undefined>;

  return (
    <NodeViewWrapper as="span">
      <HoverCard>
        <HoverCardTrigger asChild>
          <a {...extension.options.HTMLAttributes}>
            {/* @ts-expect-error: Nodeview content declares only `div` is acceptable when passed to `as`, but we need a `span` */}
            <NodeViewContent as="span" />
          </a>
        </HoverCardTrigger>
        <HoverCardContent className="w-120 max-h-96 m-2 overflow-auto">
          <GlossaryInsanceCard uuid={node.attrs.glossary} fetch={fetch} />
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  );
};
