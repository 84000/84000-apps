import { Transformer } from './transformer';

export const span: Transformer = ({ block }) => {
  return block;
};
