import { AudioAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitAndInsert } from './split-insert';

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
