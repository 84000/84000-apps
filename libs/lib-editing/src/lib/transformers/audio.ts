import { AudioAnnotation } from '@data-access';
import { Transformer } from './transformer';
import { splitContent } from './split-content';

export const audio: Transformer = ({ block, annotation }) => {
  splitContent({
    block,
    annotation,
    transform: (item) => {
      const audio = annotation as AudioAnnotation;
      return [
        {
          ...item,
          type: 'audio',
          attrs: {
            ...item.attrs,
            src: audio.src,
            mediaType: audio.mediaType,
          },
        },
      ];
    },
  });
};
