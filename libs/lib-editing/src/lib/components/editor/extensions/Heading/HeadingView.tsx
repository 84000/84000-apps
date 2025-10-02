import { NodeViewProps } from '@tiptap/react';
import type { Level } from '@tiptap/extension-heading';
import {
  H1_STYLE,
  H2_STYLE,
  H3_STYLE,
  H4_STYLE,
  H5_STYLE,
} from '@design-system';
import { NodeWrapper } from '../NodeWrapper';
import { JSX } from 'react';

const CLASS_FOR_LEVEL: Record<Level, string> = {
  1: H1_STYLE,
  2: H2_STYLE,
  3: H3_STYLE,
  4: H4_STYLE,
  5: H5_STYLE,
  6: H5_STYLE,
};

export const HeadingView = (props: NodeViewProps) => {
  const { node, extension } = props;
  const nodeLevel = parseInt(node.attrs.level, 10) as Level;
  const hasLevel = extension.options.levels.includes(nodeLevel);
  const level = hasLevel ? nodeLevel : extension.options.levels[0];
  const element = `h${level}` as keyof JSX.IntrinsicElements;
  const className = CLASS_FOR_LEVEL[nodeLevel];

  return (
    <NodeWrapper {...props} contentAs={element} innerClassName={className} />
  );
};
