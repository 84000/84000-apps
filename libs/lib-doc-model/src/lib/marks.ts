import type { JSONContent } from '@tiptap/core';

type MarkJSON = NonNullable<JSONContent['marks']>[number];

const sameMarks = (a: JSONContent, b: JSONContent) =>
  JSON.stringify(a.marks ?? []) === JSON.stringify(b.marks ?? []);

/** Join adjacent text nodes that carry the same marks. */
const joinText = (content: JSONContent[]): JSONContent[] =>
  content.reduce<JSONContent[]>((joined, item) => {
    const last = joined[joined.length - 1];
    if (
      last?.type === 'text' &&
      item.type === 'text' &&
      sameMarks(last, item)
    ) {
      joined[joined.length - 1] = {
        ...last,
        text: `${last.text ?? ''}${item.text ?? ''}`,
      };
    } else {
      joined.push(item);
    }
    return joined;
  }, []);

/**
 * A passage's content with every mark passed through `map`, which returns the
 * mark unchanged, a replacement, or null to remove it. Null when nothing
 * changed.
 */
export const mapMarks = (
  content: JSONContent,
  map: (mark: MarkJSON) => MarkJSON | null,
): JSONContent | null => {
  let changed = false;

  const visit = (item: JSONContent): JSONContent => {
    const marks = item.marks?.flatMap((mark) => {
      const next = map(mark);
      if (next !== mark) changed = true;
      return next ? [next] : [];
    });
    const children = item.content?.map(visit);
    return {
      ...item,
      ...(marks ? { marks } : {}),
      ...(children ? { content: joinText(children) } : {}),
    };
  };

  const result = visit(content);
  return changed ? result : null;
};
