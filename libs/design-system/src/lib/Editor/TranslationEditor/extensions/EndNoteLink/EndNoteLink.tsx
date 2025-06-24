import { cn } from '@lib-utils';
import { NodeViewContent, NodeViewProps, NodeViewWrapper } from '@tiptap/react';
import { LINK_STYLE } from '../../../../Typography/Typography';
import { useEffect, useState } from 'react';

export const EndNoteLink = ({ node, getPos, editor }: NodeViewProps) => {
  const [label, setLabel] = useState(1);

  useEffect(() => {
    const pos = getPos();

    let newLabel = 1;
    editor.state.doc.descendants((descendant, nodePos) => {
      if (nodePos >= pos) {
        return false;
      }

      if (descendant.type.name === node.type.name) {
        newLabel += 1;
      }
    });
    setLabel(newLabel);
  }, [editor.state.doc, getPos, node.type.name]);

  const className = editor.isEditable
    ? 'cursor-pointer select-text'
    : 'cursor-pointer select-none';

  return (
    <NodeViewWrapper as="sup">
      <NodeViewContent as="span" />
      <a
        href={`#${node.attrs.endNote}`}
        className={cn(LINK_STYLE, className, 'pl-0.5')}
      >
        {label}
      </a>
    </NodeViewWrapper>
  );
};

export default EndNoteLink;
