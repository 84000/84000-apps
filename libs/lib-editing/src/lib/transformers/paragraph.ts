import { Transformer, scan } from './transformer';

export const paragraph: Transformer = ({ block, annotation }) => {
  if (block.type === 'paragraph') {
    return block;
  }

  return scan({
    block,
    annotation,
    transform: (item) => [
      {
        ...item,
        type: 'paragraph',
        attrs: {
          ...item.attrs,
        },
        content: [
          {
            type: 'text',
            text: item.text,
          },
        ],
      },
    ],
  });
};
