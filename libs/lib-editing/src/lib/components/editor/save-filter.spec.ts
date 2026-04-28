import { computeSavePayload } from './save-filter';

describe('computeSavePayload', () => {
  it('saves dirty UUIDs that still exist in the current editor state', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(['a']),
      baseline: {
        translation: new Set(['a', 'b']),
      },
      current: {
        translation: new Set(['a', 'b']),
      },
    });

    expect(result.uuidsToSave).toEqual(['a']);
    expect(result.uuidsToDelete).toEqual([]);
    expect(result.hasChanges).toBe(true);
  });

  it('deletes baseline UUIDs missing from the current editor state', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(),
      baseline: {
        translation: new Set(['a', 'b']),
      },
      current: {
        translation: new Set(['a']),
      },
    });

    expect(result.uuidsToSave).toEqual([]);
    expect(result.uuidsToDelete).toEqual(['b']);
    expect(result.hasChanges).toBe(true);
  });

  it('does not delete a restored baseline UUID', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(),
      baseline: {
        translation: new Set(['a']),
      },
      current: {
        translation: new Set(['a']),
      },
    });

    expect(result.uuidsToSave).toEqual([]);
    expect(result.uuidsToDelete).toEqual([]);
    expect(result.hasChanges).toBe(false);
  });

  it('saves new UUIDs that are not in the baseline', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(),
      baseline: {
        translation: new Set(['a']),
      },
      current: {
        translation: new Set(['a', 'b']),
      },
    });

    expect(result.uuidsToSave).toEqual(['b']);
    expect(result.uuidsToDelete).toEqual([]);
    expect(result.hasChanges).toBe(true);
  });

  it('does not save unchanged baseline UUIDs without dirty hints', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(),
      baseline: {
        translation: new Set(['a']),
      },
      current: {
        translation: new Set(['a']),
      },
    });

    expect(result.uuidsToSave).toEqual([]);
    expect(result.uuidsToDelete).toEqual([]);
    expect(result.hasChanges).toBe(false);
  });

  it('does not save UUIDs that are also deleted', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(['a']),
      baseline: {
        translation: new Set(['a']),
      },
      current: {
        translation: new Set(),
      },
    });

    expect(result.uuidsToSave).toEqual([]);
    expect(result.uuidsToDelete).toEqual(['a']);
    expect(result.hasChanges).toBe(true);
  });

  it('tracks independent editor baselines separately', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(['n1']),
      baseline: {
        translation: new Set(['a']),
        endnotes: new Set(['n1', 'n2']),
      },
      current: {
        translation: new Set(['a']),
        endnotes: new Set(['n1', 'n3']),
      },
    });

    expect(result.uuidsToSave).toEqual(['n1', 'n3']);
    expect(result.uuidsToDelete).toEqual(['n2']);
    expect(result.hasChanges).toBe(true);
  });
});
