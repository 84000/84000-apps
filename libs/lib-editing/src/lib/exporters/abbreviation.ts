import { AbbreviationAnnotation } from '@data-access';
import { Exporter } from './export';

export const abbreviation: Exporter<AbbreviationAnnotation> = ({
  node,
  parent,
  start,
  passageUuid,
}): AbbreviationAnnotation => {
  const textContent = node.textContent || parent.textContent || '';
  const abbreviation = node.attrs.abbreviation;
  const uuid = node.attrs.uuid;

  return {
    uuid,
    passageUuid,
    type: 'abbreviation',
    start,
    end: start + textContent.length,
    abbreviation,
  };
};
