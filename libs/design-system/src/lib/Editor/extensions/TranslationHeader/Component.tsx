import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { TranslationHeader } from '../../../Translation/Passage/Passage';

export default () => {
  return (
    <NodeViewWrapper className="passage-translation-header">
      <TranslationHeader>
        <NodeViewContent className="passage-translation-header-content" />
      </TranslationHeader>
    </NodeViewWrapper>
  );
};
