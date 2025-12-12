import { MantraAnnotation } from '@data-access';
import { Exporter } from './export';

export const mantra: Exporter<MantraAnnotation> = ({
  node,
  start,
  passageUuid,
}): MantraAnnotation | undefined => {
  const { uuid, lang } = node.attrs;

  const textContent = node.textContent || '';
  if (!textContent) {
    console.warn(`Mantra ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'mantra',
    lang,
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
