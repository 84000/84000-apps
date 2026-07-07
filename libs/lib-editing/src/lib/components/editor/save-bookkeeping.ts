/**
 * Pure bookkeeping for the save lifecycle. A save serializes its payload
 * synchronously, then awaits the network; edits typed during that await must
 * survive. The contract:
 *
 * - `beginSave` swaps the live dirty set for a fresh one before any await, so
 *   in-flight keystrokes land in the new set instead of being cleared by the
 *   post-save bookkeeping.
 * - On failure, `restoreFailedSave` unions the attempted set back in — nothing
 *   was durably confirmed, so the next save retries everything.
 * - On success, the caller keeps the swapped set as-is (it holds exactly the
 *   edits made during the flight) and uses `filterReplacements` to keep the
 *   server from overwriting passages the user has already re-edited.
 */

export const beginSave = (
  dirtyUuids: Set<string>,
): { inFlight: Set<string>; next: Set<string> } => ({
  inFlight: dirtyUuids,
  next: new Set<string>(),
});

export const restoreFailedSave = (
  inFlight: Set<string>,
  dirtiedDuringFlight: Set<string>,
): Set<string> => {
  const restored = new Set(inFlight);
  dirtiedDuringFlight.forEach((uuid) => restored.add(uuid));
  return restored;
};

export const filterReplacements = <T extends { uuid: string }>(
  replacements: T[],
  residualDirty: Set<string>,
): T[] => replacements.filter((passage) => !residualDirty.has(passage.uuid));
