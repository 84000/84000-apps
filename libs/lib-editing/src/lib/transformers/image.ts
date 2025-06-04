import { ImageAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';

export const image: Transformer = ({ block, annotation }) => {
  return scan({
    block,
    annotation,
    transform: (item) => {
      const image = annotation as ImageAnnotation;
      return {
        ...item,
        type: 'image',
        attrs: {
          ...item.attrs,
          src: image.src,
        },
      };
    },
  });
};
