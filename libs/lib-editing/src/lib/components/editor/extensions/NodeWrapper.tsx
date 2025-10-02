import {
  NodeViewContent,
  NodeViewProps,
  NodeViewRendererOptions,
  NodeViewWrapper,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import { JSX, ReactNode, useEffect } from 'react';
import { validateAttrs } from '../util';

export interface NodeWrapperProps extends NodeViewProps {
  className?: string;
  innerClassName?: string;
  children?: ReactNode;
  wrapperAs?: keyof JSX.IntrinsicElements;
  contentAs?: keyof JSX.IntrinsicElements;
}

export const NodeWrapper = ({
  node,
  editor,
  className,
  innerClassName,
  children,
  wrapperAs = 'div',
  contentAs = 'div',
  getPos,
  updateAttributes,
}: NodeWrapperProps) => {
  useEffect(() => {
    validateAttrs({ node, editor, getPos, updateAttributes });
  }, [node, editor, getPos, updateAttributes]);

  return (
    <NodeViewWrapper as={wrapperAs} className={className}>
      {children}
      {/* @ts-expect-error: NodeViewContent is only typed for div, but any element works */}
      <NodeViewContent as={contentAs} className={innerClassName} />
    </NodeViewWrapper>
  );
};

export interface CreateNodeWrapperOptions extends NodeViewRendererOptions {
  className?: string;
  innerClassName?: string;
  children?: ReactNode;
  wrapperAs?: keyof JSX.IntrinsicElements;
  contentAs?: keyof JSX.IntrinsicElements;
}

export const createNodeWrapper = (
  options: Partial<Omit<NodeWrapperProps, keyof NodeViewProps>> = {},
) => {
  return ReactNodeViewRenderer((props: NodeViewProps) => (
    <NodeWrapper {...props} {...options} />
  ));
};
