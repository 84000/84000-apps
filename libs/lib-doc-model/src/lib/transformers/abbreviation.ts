import { AbbreviationAnnotation } from '@eightyfourthousand/data-access';
import { markUnplaceable, recurse } from './recurse';
import { Transformer } from './transformer';
import { splitContent } from './split-content';

export const abbreviation: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { abbreviation, uuid } = annotation as AbbreviationAnnotation;

  const matched = recurse({
    until: ['text'],
    ...ctx,
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'abbreviation';
          block.attrs = {
            ...block.attrs,
            abbreviation,
            uuid,
          };
          block.content = [
            { type: 'text', text: block.text, marks: block.marks },
          ];
        },
      });
    },
  });

  if (!matched) {
    markUnplaceable(annotation);
  }
};
