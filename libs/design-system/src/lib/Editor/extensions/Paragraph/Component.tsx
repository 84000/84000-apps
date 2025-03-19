import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { P } from '../../../Typography/Typography';

export default ({ node }: NodeViewProps) => {
  return (
    <NodeViewWrapper className="paragraph">
      <P>
        <NodeViewContent className="paragraph-content" />
      </P>
    </NodeViewWrapper>
  );
};
