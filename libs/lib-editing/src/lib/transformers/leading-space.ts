import { Transformer } from './transformer';

export const leadingSpace: Transformer = ({ block }) => {
  if (block.type === 'paragraph') {
    if (!block.attrs) {
      block.attrs = {};
    }
    block.attrs.hasLeadingSpace = true;
    return block;
  }

  let parent = block.parent;
  while (parent) {
    if (parent.type === 'paragraph') {
      if (!parent.attrs) {
        parent.attrs = {};
      }
      parent.attrs.hasLeadingSpace = true;
      break;
    }
    parent = parent.parent;
  }

  return block;
};
