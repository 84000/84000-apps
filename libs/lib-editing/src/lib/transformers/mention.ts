import { MentionAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { recurse } from './recurse';
import { splitNode } from './split-node';
import type { TranslationEditorContentItem } from '../components/editor';

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

  // Recurse to text level so parent = paragraph, block = text node.
  // This ensures the mention is inserted inline within the paragraph's
  // content (not as a sibling of the paragraph at the passage level).
  recurse({
    ...ctx,
    until: ['text'],
    transform: (ctx) => {
      const { parent } = ctx;
      if (!parent || !parent.content) {
        return;
      }

      // Check if a mention Node already exists at this position for batching
      const existingMention = parent.content.find(
        (child) =>
          child.type === 'mention' &&
          child.attrs?.start === start &&
          child.attrs?.end === end,
      );

      if (existingMention) {
        const items = existingMention.attrs?.items || [];
        items.push(item);
        existingMention.attrs = { ...existingMention.attrs, items };
        return;
      }

      // Split the text node at the insertion point and insert mention inline
      const newContent: TranslationEditorContentItem[] = [];
      let inserted = false;

      for (const child of parent.content) {
        if (inserted) {
          newContent.push(child);
          continue;
        }

        const { prefix, middle, suffix } = splitNode(child, start, end);
        newContent.push(...prefix);
        newContent.push(...middle);

        // Insert at the boundary between prefix and suffix (zero-length point)
        if (prefix.length > 0 || middle.length > 0) {
          const mentionNode: TranslationEditorContentItem = {
            type: 'mention',
            attrs: {
              start,
              end: start,
              items: [item],
            },
          };
          newContent.push(mentionNode);
          inserted = true;
        }

        newContent.push(...suffix);
      }

      // If we haven't inserted yet (annotation at the very end), append
      if (!inserted) {
        const mentionNode: TranslationEditorContentItem = {
          type: 'mention',
          attrs: {
            start,
            end: start,
            items: [item],
          },
        };
        newContent.push(mentionNode);
      }

      parent.content = newContent;
    },
  });
};
