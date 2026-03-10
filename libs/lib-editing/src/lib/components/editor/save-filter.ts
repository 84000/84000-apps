/**
 * Compute which passage UUIDs should be saved and which should be deleted.
 * Passages that are both dirty and deleted are excluded from the save list
 * (they no longer exist in the editor).
 */
export const computeSavePayload = ({
  dirtyUuids,
  deletedUuids,
}: {
  dirtyUuids: Set<string>;
  deletedUuids: Set<string>;
}): {
  uuidsToSave: string[];
  uuidsToDelete: string[];
  hasChanges: boolean;
} => {
  const uuidsToDelete = Array.from(deletedUuids);
  const uuidsToSave = Array.from(dirtyUuids).filter(
    (uuid) => !deletedUuids.has(uuid),
  );

  return {
    uuidsToSave,
    uuidsToDelete,
    hasChanges: uuidsToSave.length > 0 || uuidsToDelete.length > 0,
  };
};
