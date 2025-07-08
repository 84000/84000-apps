import { ImageAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitBlock } from './split-block';

export const image: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { src, uuid, start, end } = annotation as ImageAnnotation;
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) => {
      splitBlock({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'image';
          block.attrs = {
            ...block.attrs,
            src,
            uuid,
            start,
            end,
          };
        },
      });
    },
  });
};
