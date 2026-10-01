import { mapMarks, type WorkDocument } from '@eightyfourthousand/lib-doc-model';

/**
 * Take a comment thread's anchors off every passage the stack holds, rows
 * outside the DOM included, so their next save deletes the anchor rows.
 */
export const removeStackCommentAnchors = (
  work: WorkDocument,
  comment: string,
) => {
  work.store.held().forEach((uuid) => {
    const doc = work.store.peek(uuid);
    if (!doc) return;
    const json = mapMarks(doc.toJSON(), (mark) =>
      mark.type === 'comment' && mark.attrs?.comment === comment ? null : mark,
    );
    if (json) doc.replaceContent(json);
  });
};
