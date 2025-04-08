import { Transformer, scan } from './transformer';

export const blockquote: Transformer = ({ block, annotation }) => {
  return scan({
    block,
    annotation,
    transform: (item) => ({
      ...item,
      type: 'blockquote',
      attrs: {
        ...item.attrs,
      },
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: item.text,
            },
          ],
        },
      ],
    }),
  });
};
