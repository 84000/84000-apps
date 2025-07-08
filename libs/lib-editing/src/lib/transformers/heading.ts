import { HeadingAnnotation } from '@data-access';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { recurse } from './recurse';

export const heading: Transformer = ({ root, parent, block, annotation }) => {
  const level = (annotation as HeadingAnnotation).level || 1;
  recurse({
    until: ['heading'],
    root,
    parent,
    block,
    annotation,
    transform: (ctx) =>
      splitBlock({
        ...ctx,
        transform: ({ block: item }) => {
          item.type = 'heading';
          item.attrs = {
            ...item.attrs,
            level,
            start: annotation?.start,
            end: annotation?.end,
            uuid: annotation.uuid,
          };
        },
      }),
  });
};
