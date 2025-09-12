import { GlossaryInstanceAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitContent } from './split-content';

export const glossaryInstance: Transformer = (ctx) => {
  const { annotation } = ctx;
  const { uuid, glossary, start, end } =
    annotation as GlossaryInstanceAnnotation;

  if (!glossary) {
    console.warn(`Glossary instance ${uuid} is missing glossary UUID`);

    return;
  }

  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      splitContent({
        ...ctx,
        transform: (ctx) => {
          const { block } = ctx;
          const text = block.text;
          block.type = 'glossaryInstance';
          block.attrs = {
            ...block.attrs,
            start,
            end,
            uuid,
            glossary,
          };
          block.content = [{ type: 'text', text, marks: block.marks }];
        },
      });
    },
  });
};
