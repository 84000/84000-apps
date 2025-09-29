import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { useEffect } from 'react';
import { ensureNodeUuid } from '../../util';

export const ParagraphView = ({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) => {
  useEffect(() => {
    ensureNodeUuid({ node, editor, getPos, updateAttributes });
  }, [node, editor, getPos, updateAttributes]);

  return (
    <NodeViewWrapper className="leading-7 mb-1 mt-2">
      <NodeViewContent />
    </NodeViewWrapper>
  );
};
