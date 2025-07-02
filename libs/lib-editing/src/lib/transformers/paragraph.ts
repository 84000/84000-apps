import { recurse } from './recurse';
import { Transformer } from './transformer';

export const paragraph: Transformer = ({
  block,
  annotation,
  childAnnotations = [],
}) => {
  if (block.type !== 'paragraph') {
    console.warn(
      'Paragraph transformer expects to operate on a block of type "paragraph".',
    );
    return;
  }

  recurse({
    block,
    annotation,
    childAnnotations,
    transform: (item) => {
      item.type = 'paragraph';
      return [item];
    },
  });
};
