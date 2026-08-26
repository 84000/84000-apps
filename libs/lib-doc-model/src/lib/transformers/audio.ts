import { AudioAnnotation } from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitAndInsert } from './split-insert';
import { tohAttrs } from '../annotation-attrs';

export const audio: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { src, mediaType, uuid, start, end } = annotation as AudioAnnotation;
  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) => {
      splitAndInsert({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'audio';
          block.attrs = {
            ...block.attrs,
            ...tohAttrs(annotation),
            src,
            mediaType,
            uuid,
            start,
            end,
          };
        },
      });
    },
  });
};
