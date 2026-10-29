import { combineSaveOutcomes } from './save-bookkeeping';

describe('combineSaveOutcomes', () => {
  // A part that may have been applied has to be read back before anything is
  // saved again, whatever the other parts did.
  it('is unknown when any part may or may not have been applied', () => {
    expect(combineSaveOutcomes(['failed', 'unknown'])).toBe('unknown');
    expect(combineSaveOutcomes(['unknown', 'saved'])).toBe('unknown');
  });

  it('fails when any part failed', () => {
    expect(combineSaveOutcomes(['saved', 'failed'])).toBe('failed');
  });

  // One part alone had changes: the other had nothing to save.
  it('saved when any part wrote something', () => {
    expect(combineSaveOutcomes(['saved', 'none'])).toBe('saved');
  });

  it('nothing to save when no part had anything', () => {
    expect(combineSaveOutcomes(['none', 'none'])).toBe('none');
  });
});
