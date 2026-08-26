import { ImageAnnotation } from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitAndInsert } from './split-insert';
import { tohAttrs } from '../annotation-attrs';

export const image: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { src, uuid, start, end } = annotation as ImageAnnotation;
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) => {
      splitAndInsert({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'image';
          block.attrs = {
            ...block.attrs,
            ...tohAttrs(annotation),
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
