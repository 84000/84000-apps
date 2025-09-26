import { QuoteAnnotation } from '@data-access';
import { Exporter } from './export';

export const quote: Exporter<QuoteAnnotation> = ({
  node,
  mark,
  start,
  passageUuid,
}): QuoteAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = mark?.attrs.uuid;

  if (!textContent) {
    console.warn(`List item ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'quote',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
