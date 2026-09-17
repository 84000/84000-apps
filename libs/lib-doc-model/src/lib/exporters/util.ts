import { Node, Mark } from '@tiptap/pm/model';

export const findNodePosition = (
  parent: Node,
  uuid: string,
  type: string,
): number | undefined => {
  let textOffset = 0;
  let targetFound = false;

  const traverse = (node: Node): boolean => {
    if (node.attrs?.uuid === uuid && node.type.name === type) {
      targetFound = true;
      return true;
    }

    if (node.isText) {
      if (node.marks && node.marks.length > 0) {
        for (const mark of node.marks) {
          if (mark.attrs?.uuid === uuid && mark.type.name === type) {
            targetFound = true;
            return true;
          }
        }
      }

      if (!targetFound) {
        textOffset += node?.text?.length || 0;
      }
      return false;
    }

    // Handle nodes with content
    if (node.content && node.content.size > 0) {
      for (let i = 0; i < node.content.childCount; i++) {
        const child = node.content.child(i);
        const found = traverse(child);
        if (found) {
          return true;
        }
      }
    }

    return false;
  };

  if (parent.content && parent.content.size > 0) {
    for (let i = 0; i < parent.content.childCount; i++) {
      const child = parent.content.child(i);
      const found = traverse(child);
      if (found) break;
    }
  }

  return targetFound ? textOffset : undefined;
};

export const nodeNotFound = (
  node: Node | Mark,
  skipped?: { count: number },
) => {
  console.error(
    `Could not find position of node with uuid ${node.attrs.uuid} and type ${node.type.name}; its annotation was not exported`,
  );
  if (skipped) {
    skipped.count++;
  }
};

/**
 * Whether a block that contributes no characters still holds something worth
 * persisting.
 *
 * A block whose only children are inline atoms — a folio mention, an image —
 * has no text of its own, but it is still a block the editor drew, and
 * discarding it discards the line break the editor intended. Such a block
 * exports as a zero-length annotation (`start === end`), which
 * `insertBlockAt` places back on load. A block with no children at all has
 * nothing to preserve and is still dropped.
 */
export const holdsOnlyAtoms = (node: Node): boolean =>
  !node.textContent && node.childCount > 0;
