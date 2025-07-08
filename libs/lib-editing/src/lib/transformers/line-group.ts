import { recurse } from './recurse';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';

export const lineGroup: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  return recurse({
    block,
    annotation,
    childAnnotations,
    transform: (child) =>
      splitBlock({
        block: child,
        annotation,
        childAnnotations,
        transform: (item) => ({
          ...item,
          type: 'lineGroup',
          attrs: {
            ...item.attrs,
          },
          content: [
            {
              type: 'line',
              content: item.content || [],
            },
          ],
        }),
      }),
  });
};
