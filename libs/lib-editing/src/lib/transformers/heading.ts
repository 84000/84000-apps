import { HeadingAnnotation } from '@data-access';
import { splitBlock } from './split-block';
import { Transformer } from './transformer';
import { recurse } from './recurse';

export const heading: Transformer = ({ root, parent, block, annotation }) => {
  const heading = annotation as HeadingAnnotation;
  const level = heading.level || 1;
  const cls = heading.class;

  recurse({
    until: ['heading', 'paragraph'],
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
            class: cls,
          };
        },
      }),
  });
};
