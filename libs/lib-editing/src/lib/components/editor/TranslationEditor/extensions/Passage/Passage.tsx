import { cn } from '@lib-utils';
import type { ChangeEvent, FocusEvent } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeWrapper } from '../../../extensions/NodeWrapper';

export const Passage = (props: NodeViewProps) => {
  const { node, editor, updateAttributes } = props;

  const updateLabel = (
    event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>,
  ) => {
    updateAttributes({ label: event.target.value });
  };

  const className =
    'absolute -left-16 w-16 text-end text-slate hover:cursor-pointer';
  return (
    <NodeWrapper
      className="passage relative leading-7 ml-6"
      innerClassName="content is-editable pl-6"
      {...props}
    >
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
    </NodeWrapper>
  );
};

export default Passage;
