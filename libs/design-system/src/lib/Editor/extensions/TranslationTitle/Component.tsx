import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { Title } from '../../../Translation';

export default () => {
  return (
    <NodeViewWrapper className="heading">
      <Title>
        <NodeViewContent className="heading-content" />
      </Title>
    </NodeViewWrapper>
  );
};
