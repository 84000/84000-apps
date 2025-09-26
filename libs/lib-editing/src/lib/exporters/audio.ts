import { AudioAnnotation } from '@data-access';
import { Exporter } from './export';

export const audio: Exporter<AudioAnnotation> = ({
  node,
  start,
  passageUuid,
}): AudioAnnotation | undefined => {
  const uuid = node.attrs.uuid;
  const src = node.attrs.src;
  const mediaType = node.attrs.mediaType || 'audio/mpeg';

  if (!src) {
    console.warn(`Audio node ${uuid} is missing src attribute`);
    return undefined;
  }

  return {
    uuid,
    passageUuid,
    type: 'audio',
    start,
    end: start,
    src,
    mediaType,
  };
};
