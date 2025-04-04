import { Transformer } from './transformer';

export const unknown: Transformer = ({ block, annotation }) => {
  console.warn(
    `Unknown annotation type: ${annotation.type} in block ${block.uuid}`,
  );
  return block;
};
