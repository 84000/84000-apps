import { recurse } from './recurse';
import { Transformer } from './transformer';

export const lineGroup: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  recurse({
    block,
    annotation,
    childAnnotations,
    transform: (item) => {
      return [
        {
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
        },
      ];
    },
  });
};
