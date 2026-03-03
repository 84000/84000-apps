import { MentionAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitAndInsert } from './split-insert';

export const mention: Transformer = (ctx) => {
  const { annotation } = ctx;
  const {
    entity,
    linkType,
    text,
    displayText,
    uuid,
    start,
    end,
    isSameWork,
    subtype,
    linkToh,
  } = annotation as MentionAnnotation;

  recurse({
    ...ctx,
    until: ['paragraph'],
    transform: (ctx) => {
      const { parent } = ctx;

      // Check if a mention Node already exists at this position for batching
      const existingMention = parent?.content?.find(
        (item) =>
          item.type === 'mention' &&
          item.attrs?.start === start &&
          item.attrs?.end === end,
      );

      if (existingMention) {
        // Batch into existing mention's items array
        const items = existingMention.attrs?.items || [];
        items.push({
          uuid,
          entity,
          linkType,
          text,
          displayText,
          isSameWork,
          subtype,
          linkToh,
        });
        existingMention.attrs = {
          ...existingMention.attrs,
          items,
        };
        return;
      }

      // No existing mention at this position — use splitAndInsert
      splitAndInsert({
        ...ctx,
        transform: ({ block }) => {
          block.type = 'mention';
          block.attrs = {
            ...block.attrs,
            items: [
              {
                uuid,
                entity,
                linkType,
                text,
                displayText,
                isSameWork,
                subtype,
                linkToh,
              },
            ],
          };
        },
      });
    },
  });
};
