import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import { dropHeldMarks } from './held-marks';

/**
 * Take a comment thread's anchors off every row a work holds, rows outside the
 * DOM included, so their next save removes them.
 */
export const removeStackCommentAnchors = (
  work: WorkDocument,
  comment: string,
) =>
  dropHeldMarks(
    work,
    (mark) => mark.type === 'comment' && mark.attrs?.comment === comment,
    'edit',
  );
