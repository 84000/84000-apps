import { ImageAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';

export const image: Transformer = ({ block, annotation }) => {
  return splitContent({
    block,
    annotation,
    transform: (item) => {
      const image = annotation as ImageAnnotation;
      return [
        {
          ...item,
          type: 'image',
          attrs: {
            ...item.attrs,
            src: image.src,
          },
        },
      ];
    },
  });
};
