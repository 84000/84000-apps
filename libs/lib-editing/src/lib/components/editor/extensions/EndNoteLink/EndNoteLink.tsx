import { cn } from '@lib-utils';
import { NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
  Skeleton,
} from '@design-system';
import { useEffect, useState } from 'react';
import TranslationEditor, {
  TranslationEditorContent,
} from '../../TranslationEditor';
import { validateAttrs } from '../../util';

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

  const fetch = extension.options.fetch as (
    uuid: string,
  ) => Promise<TranslationEditorContent | undefined>;

  useEffect(() => {
    const pos = getPos() || 0;

    let newLabel = 1;
    editor.state.doc.descendants((descendant, nodePos) => {
      if (nodePos >= pos) {
        return false;
      }

      if (descendant.type.name === node.type.name) {
        newLabel += 1;
      }
    });
    setLabel(newLabel);
  }, [editor.state.doc, getPos, node.type.name]);

  useEffect(() => {
    validateAttrs({ node, editor, getPos, updateAttributes });
  }, [node, editor, getPos, updateAttributes]);

  const className = editor.isEditable ? 'select-text' : 'select-none';

  return (
    <NodeViewWrapper as="sup" contentEditable={false}>
      <HoverCard>
        <HoverCardTrigger asChild>
          <a
            href={`#${node.attrs.endNote}`}
            className={cn('end-note-link', className)}
          >
            {label}
          </a>
        </HoverCardTrigger>
        <HoverCardContent className="w-120 max-h-96 m-2 overflow-auto">
          <EndNoteCard uuid={node.attrs.endNote} fetch={fetch} />
        </HoverCardContent>
      </HoverCard>
    </NodeViewWrapper>
  );
};

export default EndNoteLink;
