import { TrailerAnnotation } from '@data-access';
import { Exporter } from './export';

export const trailer: Exporter<TrailerAnnotation> = ({
  node,
  start,
  passageUuid,
}) => {
  const textContent = node.textContent;
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Trailer node ${uuid} is missing body text`);
    return undefined;
  }

  return {
    uuid,
    type: 'trailer',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
