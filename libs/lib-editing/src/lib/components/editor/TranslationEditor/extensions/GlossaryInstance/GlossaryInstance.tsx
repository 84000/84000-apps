import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Skeleton,
} from '@design-system';
import { useEffect, useState } from 'react';
import { GlossaryTermInstance } from '@data-access';
import { usePathname } from 'next/navigation';
import { ensureNodeUuid } from '../../../util';
import { GlossaryInstanceBody } from '../../../../page';
import Link from 'next/link';

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
  const [url, setUrl] = useState<string>('#');

  const pathname = usePathname();

  const fetch = extension.options.fetch as (
    uuid: string,
  ) => Promise<GlossaryTermInstance | undefined>;

  useEffect(() => {
    ensureNodeUuid({ node, editor, getPos, updateAttributes });
  }, [node, editor, getPos, updateAttributes]);

  useEffect(() => {
    if (!node.attrs.glossary) {
      return;
    }

    const pathSegments = pathname.split('/');
    pathSegments[pathSegments.length - 1] = `glossary#${node.attrs.glossary}`;
    const newPath = pathSegments.join('/');

    setUrl(newPath);
  }, [node, pathname, setUrl]);

  return (
    <NodeViewWrapper as="span">
      <HoverCard>
        <HoverCardTrigger asChild>
          <Link scroll={false} href={url} {...extension.options.HTMLAttributes}>
            {/* @ts-expect-error: Nodeview content declares only `div` is acceptable when passed to `as`, but we need a `span` */}
            <NodeViewContent as="span" />
          </Link>
        </HoverCardTrigger>
        <HoverCardContent className="w-120 lg:w-4xl max-h-100 m-2 overflow-auto">
          <GlossaryInstanceCard uuid={node.attrs.glossary} fetch={fetch} />
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  );
};
