import { cn } from '@lib-utils';
import { useEffect, type ChangeEvent, type FocusEvent } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { ensureNodeUuid } from '../../../util';

export const Passage = ({
  node,
  editor,
  getPos,
  updateAttributes,
}: NodeViewProps) => {
  const updateLabel = (
    event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>,
  ) => {
    updateAttributes({ label: event.target.value });
  };

  useEffect(() => {
    ensureNodeUuid({ node, editor, getPos, updateAttributes });
  }, [node, editor, getPos, updateAttributes]);

  const className =
    'absolute -left-16 w-16 text-end text-slate hover:cursor-pointer';
  return (
    <NodeViewWrapper className="passage relative leading-7 ml-6">
      {editor.isEditable ? (
        <input
          className={cn(className, 'px-1 placeholder:text-slate-100')}
          value={node.attrs.label || ''}
          onChange={updateLabel}
          onBlur={updateLabel}
          placeholder="x.x"
          type="text"
          spellCheck={false}
        />
      ) : (
        <div className={className} contentEditable={false}>
          {node.attrs.label || ''}
        </div>
      )}
      <NodeViewContent className="content is-editable pl-6" />
    </NodeViewWrapper>
  );
};

export default Passage;
