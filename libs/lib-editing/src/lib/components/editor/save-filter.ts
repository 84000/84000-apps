export type PassageUuidRecord = Record<string, Set<string>>;

export const computeSavePayload = ({
  dirtyUuids,
  baseline,
  current,
}: {
  dirtyUuids: Set<string>;
  baseline: PassageUuidRecord;
  current: PassageUuidRecord;
}): {
  uuidsToSave: string[];
  uuidsToDelete: string[];
  hasChanges: boolean;
} => {
  const uuidsToDelete = new Set<string>();
  const uuidsToSave = new Set<string>();

  Object.entries(baseline).forEach(([key, baselineForKey]) => {
    const currentForKey = current[key] ?? new Set<string>();
    baselineForKey.forEach((uuid) => {
      if (!currentForKey.has(uuid)) {
        uuidsToDelete.add(uuid);
      }
    });
  });

  Object.entries(current).forEach(([key, currentForKey]) => {
    const baselineForKey = baseline[key] ?? new Set<string>();
    currentForKey.forEach((uuid) => {
      if (!baselineForKey.has(uuid)) {
        uuidsToSave.add(uuid);
        return;
      }

      if (dirtyUuids.has(uuid)) {
        uuidsToSave.add(uuid);
      }
    });
  });

  uuidsToDelete.forEach((uuid) => uuidsToSave.delete(uuid));

  return {
    uuidsToSave: Array.from(uuidsToSave),
    uuidsToDelete: Array.from(uuidsToDelete),
    hasChanges: uuidsToSave.size > 0 || uuidsToDelete.size > 0,
  };
};
