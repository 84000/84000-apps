import { MantraAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';

export const mantra: Exporter<MantraAnnotation> = ({
  mark,
  node,
  start,
  passageUuid,
}): MantraAnnotation | undefined => {
  if (!mark) {
    console.warn('Mantra exporter called without mark');
    return undefined;
  }

  const { uuid, lang } = mark.attrs;

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
