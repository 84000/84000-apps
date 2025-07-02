import { Transformer } from './transformer';

export const deprecated: Transformer = ({ block, annotation }) => {
  console.warn(
    `Deprecated annotation type ${annotation.type} in block ${block.uuid}`,
  );
  return block;
};
