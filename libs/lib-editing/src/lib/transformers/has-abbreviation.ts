import { HasAbbreviationAnnotation } from '@eightyfourthousand/data-access';
import { markUnplaceable, recurse } from './recurse';
import { splitContent } from './split-content';
import { Transformer } from './transformer';

export const hasAbbreviation: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { abbreviation, uuid, start, end } = annotation as HasAbbreviationAnnotation;

  const matched = recurse({
    until: ['text'],
    ...ctx,
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'hasAbbreviation';
          block.attrs = {
            ...block.attrs,
            abbreviation,
            uuid,
          };
          block.content = [
            {
              type: 'text',
              text: block.text,
              marks: block.marks,
              attrs: { start, end }
            },
          ];
        },
      });
    },
  });

  if (!matched) {
    markUnplaceable(annotation);
  }
};
