import { HasAbbreviationAnnotation } from '@84000/data-access';
import { Exporter } from './export';

export const hasAbbreviation: Exporter<HasAbbreviationAnnotation> = ({
  node,
  start,
  passageUuid,
}): HasAbbreviationAnnotation => {
  const textContent = node.textContent;
  const abbreviation = node.attrs.abbreviation;
  const uuid = node.attrs.uuid;

  return {
    uuid,
    type: 'hasAbbreviation',
    passageUuid,
    start,
    end: start + textContent.length,
    abbreviation,
  };
};
