import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { H3 } from '../../../Typography/Typography';

export default () => {
  return (
    <NodeViewWrapper className="passage-translation-header">
      <H3>
        <NodeViewContent className="passage-translation-header-content" />
      </H3>
    </NodeViewWrapper>
  );
};
