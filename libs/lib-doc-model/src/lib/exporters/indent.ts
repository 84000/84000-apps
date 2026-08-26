import { IndentAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';
import { parameterAnnotationValue, tohFromAttrs } from '../annotation-attrs';

export const indent: Exporter<IndentAnnotation> = ({
  node,
  parent,
  start,
  passageUuid,
}): IndentAnnotation | undefined => {
  const value = parameterAnnotationValue(node.attrs, 'indent');
  if (!value) {
    return undefined;
  }

  const textContent = node.textContent || parent.textContent || '';
  const toh = tohFromAttrs(value as unknown as Record<string, unknown>);

  return {
    uuid: value.uuid,
    type: 'indent',
    passageUuid,
    start,
    end: start + textContent.length,
    ...(toh.length ? { toh } : {}),
  };
};
