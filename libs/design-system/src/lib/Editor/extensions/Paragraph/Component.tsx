import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { P } from '../../../Typography/Typography';

export default ({ node }: NodeViewProps) => {
  return (
    <NodeViewWrapper className="heading">
      <P>
        <NodeViewContent className="heading-content" />
      </P>
    </NodeViewWrapper>
  );
};
