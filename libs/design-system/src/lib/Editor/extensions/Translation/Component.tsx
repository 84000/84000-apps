import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { TranslationPassage } from '../../../Translation/Passage/Passage';

export default (_props: NodeViewProps) => {
  return (
    <NodeViewWrapper className="passage-translation">
      <TranslationPassage className="pt-4">
        <NodeViewContent className="passage-translation-content" />
      </TranslationPassage>
    </NodeViewWrapper>
  );
};
