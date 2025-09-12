import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Separator,
  Skeleton,
} from '@design-system';
import { useEffect, useState } from 'react';
import { GlossaryTermInstance } from '@data-access';
import { removeHtmlTags } from '@lib-utils';

export const GlossaryInsanceCard = ({
  uuid,
  fetch,
}: {
  uuid: string;
  fetch?: (uuid: string) => Promise<GlossaryTermInstance | undefined>;
}) => {
  const [content, setContent] = useState<GlossaryTermInstance>();

  const [definition, setDefinition] = useState<string>();

  useEffect(() => {
    if (!uuid || content || !fetch) {
      return;
    }

    (async () => {
      const res = await fetch?.(uuid);
      setContent(res);
    })();
  }, [uuid, content, fetch]);

  useEffect(() => {
    if (!content?.definition) {
      return;
    }

    const plainText = removeHtmlTags(content.definition);
    setDefinition(plainText);
  }, [content, setDefinition]);

  if (!content) {
    return <Skeleton className="p-2 h-20 w-full" />;
  }

  return (
    <div className="p-2 flex gap-1 flex-col">
      {content.names.english && (
        <div className="text-xl font-serif">{content.names.english}</div>
      )}
      {content.names.wylie && (
        <div className="italic">{content.names.wylie}</div>
      )}
      {content.names.tibetan && (
        <div className="text-lg">{content.names.tibetan}</div>
      )}
      {content.names.sanskrit && (
        <div className="italic">{content.names.sanskrit}</div>
      )}
      {content.names.chinese && <div>{content.names.chinese}</div>}
      {content.names.pali && <div className="italic">{content.names.pali}</div>}
      <Separator className="w-4 h-0.25 my-5 bg-primary/80" />
      {definition && <p>{definition}</p>}
    </div>
  );
};

export const GlossaryInstance = ({ node, extension }: NodeViewProps) => {
  const fetch = extension.options.fetch as (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;

  return (
    <NodeViewWrapper as="span">
      <HoverCard>
        <HoverCardTrigger asChild>
          <a {...extension.options.HTMLAttributes}>
            {/* @ts-expect-error: Nodeview content declares only `div` is acceptable when passed to `as`, but we need a `span` */}
            <NodeViewContent as="span" />
          </a>
        </HoverCardTrigger>
        <HoverCardContent className="w-120 lg:w-4xl max-h-96 m-2 overflow-auto">
          <GlossaryInsanceCard uuid={node.attrs.glossary} fetch={fetch} />
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  );
};
