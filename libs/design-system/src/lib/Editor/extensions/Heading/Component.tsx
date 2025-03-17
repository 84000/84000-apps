import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import type { Level } from '@tiptap/extension-heading';
import { H1, H2, H3, H4 } from '../../../Typography/Typography';

export default ({ node }: NodeViewProps) => {
  const level = parseInt(node.attrs.level, 10) as Level;
  const HTag = [H1, H2, H3, H4][level - 1] || H4;
  return (
    <NodeViewWrapper className="heading">
      <HTag>
        <NodeViewContent className="heading-content" />
      </HTag>
    </NodeViewWrapper>
  );
};
