'use client';

import { cn } from '@lib-utils';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Skeleton,
} from '@design-system';
import { useCallback, useEffect, useState } from 'react';
import TranslationEditor, {
  TranslationEditorContent,
  TranslationEditorContentItem,
} from '../../TranslationEditor';
import { validateAttrs } from '../../util';
import { useSearchParams } from 'next/navigation';

export const EndNoteCard = ({
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

  if (!content) {
    return <Skeleton className="p-2 h-20 w-full" />;
  }

  return (
    <div className="p-2">
      <TranslationEditor content={content} isEditable={false} />
    </div>
  );
};

export const EndNoteLink = ({
  node,
  editor,
  extension,
  getPos,
  updateAttributes,
}: NodeViewProps) => {
  const [label, setLabel] = useState(1);
  const searchParams = useSearchParams();

  const fetch = extension.options.fetch as (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;

  const onClick = useCallback(() => {
    if (!node.attrs.endNote) {
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.set('right', `open:endnotes`);
    window.history.pushState(
      {},
      '',
      `?${params.toString()}#${node.attrs.endNote}`,
    );
  }, [node, searchParams]);

  useEffect(() => {
    (async () => {
      const [item] =
        ((await fetch?.(
          node.attrs.endNote,
        )) as TranslationEditorContentItem[]) || [];
      const label = item?.attrs?.label;
      setLabel(label?.split('.').pop() || '*');
    })();
  }, [node.attrs.endNote, fetch]);

  useEffect(() => {
    validateAttrs({ node, editor, getPos, updateAttributes });
  }, [node, editor, getPos, updateAttributes]);

  const className = editor.isEditable ? 'select-text' : 'select-none';

  return (
    <NodeViewWrapper as="sup" contentEditable={false}>
      <HoverCard>
        <HoverCardTrigger>
          <span className={cn('end-note-link', className)} onClick={onClick}>
            {label}
          </span>
        </HoverCardTrigger>
        <HoverCardContent className="w-120 max-h-96 m-2 overflow-auto">
          <EndNoteCard uuid={node.attrs.endNote} fetch={fetch} />
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  );
};

export default EndNoteLink;
