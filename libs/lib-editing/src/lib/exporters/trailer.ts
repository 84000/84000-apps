import { TrailerAnnotation } from '@data-access';
import { Exporter } from './export';

export const trailer: Exporter<TrailerAnnotation> = ({
  node,
  parent,
  start,
  passageUuid,
}) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.trailerUuid,
    type: 'trailer',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
