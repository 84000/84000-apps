import { AnnotationType } from '@data-access';
import { AnnotationExport } from './annotation';
import { Exporter } from './export';

export const basicNode: Exporter<AnnotationExport> = ({
  node,
  parent,
  start,
}) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: node.attrs.uuid,
    type: node.type.name as AnnotationType,
    attrs: node.attrs,
    textContent,
    start,
    end: start + textContent.length,
  };
};

export const basicMark: Exporter<AnnotationExport> = ({
  node,
  mark,
  parent,
  start,
}) => {
  const textContent = node.textContent || parent.textContent || '';
  return {
    uuid: mark?.attrs.uuid,
    type: mark?.type.name as AnnotationType,
    attrs: mark?.attrs,
    textContent,
    start,
    end: start + textContent.length,
  };
};
