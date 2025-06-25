import { Transformer } from './transformer';

export const trailer: Transformer = ({ block }) => {
  if (block.type === 'paragraph') {
    if (!block.attrs) {
      block.attrs = {};
    }
    block.attrs.hasTrailer = true;
    return block;
  }

  let parent = block.parent;
  while (parent) {
    if (parent.type === 'paragraph') {
      if (!parent.attrs) {
        parent.attrs = {};
      }
      parent.attrs.hasTrailer = true;
      break;
    }
    parent = parent.parent;
  }

  return block;
};
