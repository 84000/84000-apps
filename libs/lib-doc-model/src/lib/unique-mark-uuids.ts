import type { JSONContent } from '@tiptap/core';
import { v4 as uuidv4 } from 'uuid';

/**
 * Give every segment of a uuid-bearing mark its own uuid, or return null when
 * they are already unique.
 *
 * An annotation split by an overlapping one is a mark on several text nodes,
 * all sharing its uuid. Exported as-is, every segment resolves to the first
 * one's offset under the same primary key. The first segment keeps the uuid,
 * so the annotation persists as one row per segment — the mark half of
 * `ensureUuids()`, for a document rather than an editor.
 */
export const withUniqueMarkUuids = (doc: JSONContent): JSONContent | null => {
  const seen = new Set<string>();
  let changed = false;

  const visit = (item: JSONContent): JSONContent => {
    const marks = item.marks?.map((mark) => {
      const existing = mark.attrs?.uuid as string | null | undefined;
      // A mark type with no uuid attribute is not an annotation.
      if (existing === undefined) return mark;
      if (existing && !seen.has(existing)) {
        seen.add(existing);
        return mark;
      }
      const uuid = uuidv4();
      seen.add(uuid);
      changed = true;
      return { ...mark, attrs: { ...mark.attrs, uuid } };
    });
    const content = item.content?.map(visit);
    return {
      ...item,
      ...(marks ? { marks } : {}),
      ...(content ? { content } : {}),
    };
  };

  const result = visit(doc);
  return changed ? result : null;
};
