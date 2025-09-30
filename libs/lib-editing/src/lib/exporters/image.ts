import { ImageAnnotation } from '@data-access';
import { Exporter } from './export';

export const image: Exporter<ImageAnnotation> = ({
  node,
  start,
  passageUuid,
}): ImageAnnotation | undefined => {
  const src = node.attrs.src;
  const uuid = node.attrs.uuid;

  if (!src) {
    console.warn(`Image node ${uuid} is missing src attribute`);
    return undefined;
  }

  return {
    uuid,
    type: 'image',
    passageUuid,
    start,
    end: start,
    src,
  };
};
