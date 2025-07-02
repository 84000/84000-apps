import { annotateBlock } from './annotate';
import { Transformer } from './transformer';

export const trailer: Transformer = ({ block, childAnnotations = [] }) => {
  let head = block;
  while (head.type !== 'paragraph' && head.parent) {
    head = head.parent;
  }

  if (head.type !== 'paragraph') {
    console.warn(
      'Trailer transformer expects to find a parent paragraph block.',
    );
    return;
  }

  if (!head.attrs) {
    head.attrs = {};
  }
  head.attrs.hasTrailer = true;

  annotateBlock(block, childAnnotations);
};
