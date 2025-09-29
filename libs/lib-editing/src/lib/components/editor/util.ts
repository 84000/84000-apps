import { NodeViewProps } from '@tiptap/react';
import { v4 as uuidv4 } from 'uuid';

export const ensureNodeUuid = async ({
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
    updateAttributes?.({ uuid: uuidv4() });
  }
};
