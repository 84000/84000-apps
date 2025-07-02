import { recurse } from './recurse';
import { Transformer } from './transformer';

export const blockquote: Transformer = ({
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
          type: 'blockquote',
          attrs: {
            ...item.attrs,
          },
          content: [
            {
              type: item.type,
              content: item.content || [],
            },
          ],
        },
      ];
    },
  });
};
