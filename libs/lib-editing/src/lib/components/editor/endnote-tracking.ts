import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

/**
 * Collects top-level passage uuids grouped by passage type. Used by the
 * endnotes editor to detect added/deleted note passages between debounced
 * sync flushes.
 */
export const collectPassageUuidsByType = (
  doc: ProseMirrorNode,
): Record<string, Set<string>> => {
  const byType: Record<string, Set<string>> = {};
  for (let i = 0; i < doc.childCount; i++) {
    const child = doc.child(i);
    if (child.type.name === 'passage' && child.attrs.uuid) {
      const pType = (child.attrs.type as string) || 'unknown';
      (byType[pType] ??= new Set()).add(child.attrs.uuid);
    }
  }
  return byType;
};

export const diffPassageUuidsByType = (
  prev: Record<string, Set<string>>,
  curr: Record<string, Set<string>>,
): { deletedByType: Record<string, string[]>; hasAdded: boolean } => {
  const deletedByType: Record<string, string[]> = {};
  for (const pType of Object.keys(prev)) {
    prev[pType].forEach((uuid) => {
      if (!curr[pType]?.has(uuid)) {
        (deletedByType[pType] ??= []).push(uuid);
      }
    });
  }

  let hasAdded = false;
  outer: for (const pType of Object.keys(curr)) {
    for (const uuid of curr[pType]) {
      if (!prev[pType]?.has(uuid)) {
        hasAdded = true;
        break outer;
      }
    }
  }

  return { deletedByType, hasAdded };
};
