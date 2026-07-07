import {
  beginSave,
  filterReplacements,
  restoreFailedSave,
} from './save-bookkeeping';
import { computeSavePayload } from './save-filter';

describe('save bookkeeping', () => {
  it('keeps edits typed during a successful save dirty', () => {
    const dirty = new Set(['passage-1']);
    const { inFlight, next } = beginSave(dirty);

    // The user types into passage-2 while the network round-trip is pending.
    next.add('passage-2');

    // On success the in-flight set is discarded; the swapped set holds
    // exactly the mid-flight edits.
    expect(inFlight.has('passage-2')).toBe(false);
    expect(Array.from(next)).toEqual(['passage-2']);
  });

  it('restores the union of attempted and mid-flight edits on failure', () => {
    const dirty = new Set(['passage-1', 'passage-2']);
    const { inFlight, next } = beginSave(dirty);
    next.add('passage-2');
    next.add('passage-3');

    const restored = restoreFailedSave(inFlight, next);

    expect(Array.from(restored).sort()).toEqual([
      'passage-1',
      'passage-2',
      'passage-3',
    ]);
  });

  it('excludes re-dirtied passages from server replacements', () => {
    const replacements = [
      { uuid: 'passage-1', content: 'server copy' },
      { uuid: 'passage-2', content: 'server copy' },
    ];
    const residualDirty = new Set(['passage-2']);

    expect(filterReplacements(replacements, residualDirty)).toEqual([
      { uuid: 'passage-1', content: 'server copy' },
    ]);
  });

  it('detects a passage deleted mid-flight on the next save', () => {
    // Baseline snapshotted at save start includes passage-2; the user deletes
    // it during the flight, so the live set no longer has it.
    const baseline = { main: new Set(['passage-1', 'passage-2']) };
    const current = { main: new Set(['passage-1']) };

    const payload = computeSavePayload({
      dirtyUuids: new Set(),
      baseline,
      current,
    });

    expect(payload.uuidsToDelete).toEqual(['passage-2']);
    expect(payload.hasChanges).toBe(true);
  });

  it('detects a passage added mid-flight on the next save', () => {
    const baseline = { main: new Set(['passage-1']) };
    const current = { main: new Set(['passage-1', 'passage-new']) };

    const payload = computeSavePayload({
      dirtyUuids: new Set(),
      baseline,
      current,
    });

    expect(payload.uuidsToSave).toEqual(['passage-new']);
  });
});
