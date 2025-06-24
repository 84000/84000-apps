import { Transformer } from './transformer';

export const deprecated: Transformer = ({ block, annotation }) => {
  console.warn(`Deprecated annotation in block ${block.uuid}`);
  return block;
};
