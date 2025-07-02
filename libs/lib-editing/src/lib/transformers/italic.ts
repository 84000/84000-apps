import type { Transformer } from './transformer';
import { splitContent } from './split-content';
import { annotateBlock } from './annotate';

export const italic: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  splitContent({
    block,
    annotation,
    transform: (item) => [
      {
        ...item,
        marks: [...(item.marks || []), { type: 'italic' }],
      },
    ],
  });

  annotateBlock(block, childAnnotations);
};
