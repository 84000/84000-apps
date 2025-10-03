import { MarkViewProps, NodeViewProps } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Validates and updates the attributes of a Node.
 * Specifically, it ensures that the node has a unique 'uuid' attribute.
 * If the 'uuid' is missing or duplicates the previous node's 'uuid',
 * a new UUID is generated and assigned. In the case of duplication, all
 * global attributes are set to their default values.
 */
export const validateAttrs = async ({
  node,
  editor,
  getPos,
  updateAttributes,
}: Partial<NodeViewProps>) => {
  // wait for next tick to ensure node is rendered
  await Promise.resolve();

  if (!node?.attrs.uuid) {
    updateAttributes?.({ uuid: uuidv4() });
    return;
  }

  const pos = getPos?.();
  if (pos === null || pos === undefined) {
    return;
  }

  // check if previous node has same uuid, if so, set a new one
  const $pos = editor?.state.doc.resolve(pos);
  const parent = $pos?.parent;
  const index = $pos?.index();
  if (!parent || index === null || index === undefined) {
    return;
  }

  if (index > 0 && parent.child(index - 1).attrs.uuid === node.attrs.uuid) {
    const attrs: { [attr: string]: unknown } = {
      ...node.attrs,
      uuid: uuidv4(),
    };

    // reset all global attributes to default values
    if (attrs.leadingSpaceUuid) {
      attrs.leadSpaceUuid = undefined;
    }

    if (attrs.hasLeadingSpace) {
      attrs.hasLeadingSpace = false;
    }

    if (attrs.indentUuid) {
      attrs.indentUuid = undefined;
    }

    if (attrs.hasIndent) {
      attrs.hasIndent = false;
    }

    if (attrs.trailerUuid) {
      attrs.trailingSpaceUuid = undefined;
    }

    if (attrs.hasTrailer) {
      attrs.hasTrailingSpace = false;
    }

    if (attrs.hasParagraphIndent) {
      attrs.hasParagraphIndent = false;
    }

    updateAttributes?.(attrs);
  }
};

/**
 * Finds the range of a given mark in the editor's document by its reference.
 * Returns an object with 'from' and 'to' positions if found, otherwise undefined.
 */
export const findMarkByUuid = ({ editor, mark }: Partial<MarkViewProps>) => {
  if (!editor || !mark) {
    return undefined;
  }

  const { state } = editor;
  const { doc, tr } = state;

  let foundRange: { from: number; to: number } | undefined = undefined;

  const thisMark = mark;
  doc.descendants((node, pos) => {
    let foundMark = false;
    const from = tr.mapping.map(pos);
    const to = from + node.nodeSize;

    node.marks.forEach((m) => {
      if (m === thisMark) {
        foundMark = true;
        foundRange = { from, to };
        return;
      }
    });

    return !foundMark;
  });

  return foundRange;
};
