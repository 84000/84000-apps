import { IndentAnnotation } from '@data-access';
import { Exporter } from './export';

export const indent: Exporter<IndentAnnotation> = ({
  node,
  parent,
  start,
  passageUuid,
}): IndentAnnotation => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.indentUuid,
    type: 'indent',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
