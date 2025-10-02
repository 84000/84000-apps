import { NodeViewProps } from '@tiptap/react';
import { NodeWrapper } from '../NodeWrapper';

export const ParagraphView = (props: NodeViewProps) => {
  return <NodeWrapper {...props} className="leading-7 mb-1 mt-2" />;
};
