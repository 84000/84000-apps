import type { JSONContent } from '@tiptap/core';
import { mapMarks, type WorkDocument } from '@eightyfourthousand/lib-doc-model';

type MarkJSON = NonNullable<JSONContent['marks']>[number];

/**
 * Take the marks `drop` picks off every row a work holds, rows outside the DOM
 * included. As an edit, the next save sends the change; as an adjustment, a
 * clean row stays clean.
 */
export const dropHeldMarks = (
  work: WorkDocument,
  drop: (mark: MarkJSON) => boolean,
  as: 'edit' | 'adjustment',
) => {
  work.store.held().forEach((uuid) => {
    const doc = work.store.peek(uuid);
    if (!doc) return;
    const json = mapMarks(doc.toJSON(), (mark) => (drop(mark) ? null : mark));
    if (!json) return;
    if (as === 'edit') doc.replaceContent(json);
    else doc.adjust(json);
  });
};
