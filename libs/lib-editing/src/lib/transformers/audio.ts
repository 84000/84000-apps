import { AudioAnnotation } from '@data-access';
import { Transformer, scan } from './transformer';

export const audio: Transformer = ({ block, annotation }) => {
  return scan({
    block,
    annotation,
    transform: (item) => {
      const audio = annotation as AudioAnnotation;
      return {
        ...item,
        type: 'audio',
        attrs: {
          ...item.attrs,
          src: audio.src,
          mediaType: audio.mediaType,
        },
      };
    },
  });
};
