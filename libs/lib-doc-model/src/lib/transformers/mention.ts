import {
  MentionAnnotation,
  serializeTohList,
} from '@eightyfourthousand/data-access';
import { Transformer } from './transformer';
import type { TranslationEditorContentItem } from '@eightyfourthousand/data-access';
import { zeroLengthCarrier } from './insert-block';
import { markUnplaceable, recurse } from './recurse';
import { splitAndInsert } from './split-insert';

/**
 * One entity reference inside a mention node's `items` array. Mirrors the
 * annotation minus its passage span, with `toh` already serialized for the
 * node attribute.
 */
type MentionItem = Omit<
  MentionAnnotation,
  'type' | 'passageUuid' | 'start' | 'end' | 'toh' | 'validated'
> & { toh?: string };

/**
 * Adds a mention item to `container`, batching into the mention already at the
 * same position when there is one. Two folio references can share a single
 * character address — the first folio marker sometimes falls inside the title —
 * and they render as one node carrying both items.
 */
const insertOrBatch = (
  container: TranslationEditorContentItem,
  item: MentionItem,
  start: number,
  end: number,
): void => {
  const existing = (container.content || []).find(
    (child) =>
      child.type === 'mention' &&
      child.attrs?.start === start &&
      child.attrs?.end === end,
  );

  if (existing) {
    const items = existing.attrs?.items || [];
    items.push(item);
    existing.attrs = { ...existing.attrs, items };
    return;
  }

  container.content = [
    ...(container.content || []),
    { type: 'mention', attrs: { start, end, items: [item] } },
  ];
};

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
    toh,
    lang,
    style,
    highlightStart,
    highlightEnd,
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
    toh: serializeTohList(toh),
    lang,
    style,
    highlightStart,
    highlightEnd,
  };
  // A zero-length line or paragraph at this position is a block that exists
  // only to hold atoms like this one (see `insertBlockAt`) — the folio
  // reference belongs in it rather than at the head of the text that follows.
  const carrier = zeroLengthCarrier(ctx.root ?? ctx.block, start);
  if (carrier && start === end) {
    insertOrBatch(carrier, item, start, end);
    return;
  }

  const matched = recurse({
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
            // Item was batched into the existing mention; signal that no new
            // mention block should be inserted for this annotation.
            return true;
          }

          block.type = 'mention';
          block.attrs = {
            start,
            end,
            items: [item],
          };
          block.marks = [];
        },
      });
    },
  });

  if (!matched) {
    markUnplaceable(annotation);
  }
};
