import { Transformer } from './transformer';

export const quoted: Transformer = ({ block }) => {
  return block;
};
