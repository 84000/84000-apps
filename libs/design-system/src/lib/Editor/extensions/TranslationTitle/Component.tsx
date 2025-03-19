import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { Title } from '../../../Translation';

export default () => {
  return (
    <NodeViewWrapper className="translation-title">
      <Title>
        <NodeViewContent className="translation-title-content" />
      </Title>
    </NodeViewWrapper>
  );
};
