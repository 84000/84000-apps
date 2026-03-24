import { MentionAnnotation } from '@84000/data-access';
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

  const item = {
    uuid,
    entity,
    linkType,
    text,
    displayText,
    isSameWork,
    subtype,
    linkToh,
  };
  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      splitAndInsert({
        ...ctx,
        transform: ({ block, parent }) => {
          if (!parent || !parent.content) {
            console.warn(
              'mention transform: transformer expects to find a parent block with content.',
            );
            return;
          }

          // Check if a mention Node already exists at this position for batching
          const mention = parent.content.find(
            (child) =>
              child.type === 'mention' &&
              child.attrs?.start === start &&
              child.attrs?.end === end,
          );

          if (mention) {
            const items = mention.attrs?.items || [];
            items.push(item);
            mention.attrs = { ...mention.attrs, items };
            return;
          }

          block.type = 'mention';
          block.attrs = {
            start,
            end,
            items: [item],
          };
        },
      });
    },
  });
};
