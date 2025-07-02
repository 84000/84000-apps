import { annotateBlock } from './annotate';
import { sibling } from './sibling';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

export const recurse: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
  transform,
}) => {
  sibling({
    block,
    annotation,
    transform: (item) => {
      splitBlock({
        block: item,
        annotation,
        transform: (child) => {
          const transformed = transform?.(child) || [child];
          transformed.forEach((transformedItem) => {
            annotateBlock(transformedItem, childAnnotations);
          });
          return transformed;
        },
      });
    },
  });
};
