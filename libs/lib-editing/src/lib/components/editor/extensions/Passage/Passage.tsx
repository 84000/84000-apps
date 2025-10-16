import { cn } from '@lib-utils';
import { type ChangeEvent, type FocusEvent } from 'react';
import type { NodeViewProps } from '@tiptap/react';
import { NodeWrapper } from '../NodeWrapper';
import Link from 'next/link';

export const Passage = (props: NodeViewProps) => {
  const { node, editor, updateAttributes } = props;

  const updateLabel = (
    event: ChangeEvent<HTMLInputElement> | FocusEvent<HTMLInputElement>,
  ) => {
    updateAttributes({ label: event.target.value });
  };

  const className =
    'absolute labeled -left-16 w-16 text-end hover:cursor-pointer';
  const borderClassName =
    editor.storage.globalConfig.debug && node.attrs.invalid
      ? 'after:content-["⚠️"] after:absolute after:top-0 after:-right-5'
      : '';
  return (
    <NodeWrapper
      className={cn('relative ml-6 scroll-m-20', borderClassName)}
      innerClassName="passage is-editable pl-6"
      {...props}
    >
      {editor.isEditable ? (
        <input
          id={`input-${node.attrs.uuid}`}
          className={cn(className, 'px-1 placeholder:text-brick-100')}
          value={node.attrs.label || ''}
          onChange={updateLabel}
          onBlur={updateLabel}
          placeholder="x.x"
          type="text"
          spellCheck={false}
        />
      ) : (
        <Link
          className={className}
          contentEditable={false}
          href={`#${node.attrs.uuid}`}
        >
          {node.attrs.label || ''}
        </Link>
      )}
    </NodeWrapper>
  );
};

export default Passage;
