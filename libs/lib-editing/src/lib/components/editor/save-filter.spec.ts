import { computeSavePayload } from './save-filter';

describe('computeSavePayload', () => {
  it('should return dirty UUIDs as uuidsToSave when no deletions', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(['a', 'b']),
      deletedUuids: new Set(),
    });

    expect(result.uuidsToSave).toEqual(['a', 'b']);
    expect(result.uuidsToDelete).toEqual([]);
    expect(result.hasChanges).toBe(true);
  });

  it('should return deleted UUIDs as uuidsToDelete when no dirty', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(),
      deletedUuids: new Set(['x']),
    });

    expect(result.uuidsToSave).toEqual([]);
    expect(result.uuidsToDelete).toEqual(['x']);
    expect(result.hasChanges).toBe(true);
  });

  it('should exclude deleted UUIDs from the save list', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(['a', 'b', 'c']),
      deletedUuids: new Set(['b']),
    });

    expect(result.uuidsToSave).toEqual(['a', 'c']);
    expect(result.uuidsToDelete).toEqual(['b']);
    expect(result.hasChanges).toBe(true);
  });

  it('should handle a UUID that is both dirty and deleted', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(['a']),
      deletedUuids: new Set(['a']),
    });

    expect(result.uuidsToSave).toEqual([]);
    expect(result.uuidsToDelete).toEqual(['a']);
    expect(result.hasChanges).toBe(true);
  });

  it('should report no changes when both sets are empty', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(),
      deletedUuids: new Set(),
    });

    expect(result.uuidsToSave).toEqual([]);
    expect(result.uuidsToDelete).toEqual([]);
    expect(result.hasChanges).toBe(false);
  });

  it('should handle split scenario: original dirty + new dirty, none deleted', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(['original', 'new-split']),
      deletedUuids: new Set(),
    });

    expect(result.uuidsToSave).toEqual(
      expect.arrayContaining(['original', 'new-split']),
    );
    expect(result.uuidsToSave).toHaveLength(2);
    expect(result.uuidsToDelete).toEqual([]);
    expect(result.hasChanges).toBe(true);
  });

  it('should handle merge scenario: merged passage dirty + old passage deleted', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(['passage-a', 'passage-b']),
      deletedUuids: new Set(['passage-b']),
    });

    expect(result.uuidsToSave).toEqual(['passage-a']);
    expect(result.uuidsToDelete).toEqual(['passage-b']);
    expect(result.hasChanges).toBe(true);
  });

  it('should handle delete-only scenario: passage deleted without edits', () => {
    const result = computeSavePayload({
      dirtyUuids: new Set(),
      deletedUuids: new Set(['deleted-passage']),
    });

    expect(result.uuidsToSave).toEqual([]);
    expect(result.uuidsToDelete).toEqual(['deleted-passage']);
    expect(result.hasChanges).toBe(true);
  });
});
