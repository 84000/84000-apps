import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { P } from '../../../Typography/Typography';

export default (_props: NodeViewProps) => {
  return (
    <NodeViewWrapper className="passage-translation">
      <P className="pt-4">
        <NodeViewContent className="passage-translation-content" />
      </P>
    </NodeViewWrapper>
  );
};
