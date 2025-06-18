import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';

export const Passage = ({ node, updateAttributes }: NodeViewProps) => {
  if (!node.attrs.label) {
    updateAttributes({
      label: '0.',
    });
  }

  return (
    <NodeViewWrapper className="passage relative leading-7 ml-6">
      <label
        className="absolute -left-16 w-16 text-end text-slate hover:cursor-pointer"
        contentEditable={false}
      >
        {node.attrs.label}
      </label>
      <NodeViewContent className="content is-editable pl-6" />
    </NodeViewWrapper>
  );
};

export default Passage;
