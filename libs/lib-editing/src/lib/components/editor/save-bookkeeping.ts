/**
 * One result for a save made of several parts: unknown if any part may or may
 * not have been applied, failed if any part failed, saved if any part wrote
 * something, otherwise nothing to save.
 */
export const combineSaveOutcomes = (
  outcomes: ('none' | 'saved' | 'failed' | 'unknown')[],
): 'none' | 'saved' | 'failed' | 'unknown' => {
  if (outcomes.includes('unknown')) return 'unknown';
  if (outcomes.includes('failed')) return 'failed';
  if (outcomes.includes('saved')) return 'saved';
  return 'none';
};
