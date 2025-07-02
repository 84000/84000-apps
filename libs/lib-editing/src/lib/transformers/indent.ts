import { annotateBlock } from './annotate';
import { Transformer } from './transformer';

export const indent: Transformer = ({ block, childAnnotations = [] }) => {
  let head = block;
  while (head.type !== 'paragraph' && head.parent) {
    head = head.parent;
  }

  if (head.type !== 'paragraph') {
    console.warn(
      'Indent transformer expects to find a parent paragraph block.',
    );
    return;
  }

  if (!head.attrs) {
    head.attrs = {};
  }
  head.attrs.hasIndent = true;

  annotateBlock(block, childAnnotations);
};
