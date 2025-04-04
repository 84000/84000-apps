import { Transformer } from './transformer';

export const inlineTitle: Transformer = ({ block }) => {
  return block;
};
