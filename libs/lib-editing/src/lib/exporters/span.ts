import { AnnotationType } from '@data-access';
import { Exporter, ExporterContext } from './export';
import { AnnotationExportDTO } from './annotation';

const ITALIC_TYPES: AnnotationType[] = ['inlineTitle', 'mantra', 'span'];

export const span = ({
  mark,
  node,
  parent,
  types,
}: ExporterContext & { types: AnnotationType[] }):
  | AnnotationExportDTO
  | undefined => {
  const type = mark?.attrs.type;
  const uuid = mark?.attrs.uuid;
  const textStyle = mark?.attrs.textStyle;

  if (!types.includes(type as AnnotationType)) {
    console.warn(`Span mark ${uuid} has invalid type: ${type}`);
    return undefined;
  }

  const lang = mark?.attrs.lang;
  const textContent = node.textContent || parent.textContent || '';

  if (!uuid || !textContent || !lang) {
    console.warn(`Span annotation ${uuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type,
    textContent,
    attrs: {
      lang,
      textStyle,
    },
  };
};

export const bold: Exporter<AnnotationExportDTO> = ({ mark, node, parent }) =>
  span({ mark, node, parent, types: ['span'] });

export const italic: Exporter<AnnotationExportDTO> = ({ mark, node, parent }) =>
  span({ mark, node, parent, types: ITALIC_TYPES });

export const smallCaps: Exporter<AnnotationExportDTO> = ({
  mark,
  node,
  parent,
}) => span({ mark, node, parent, types: ['span'] });

export const subscript: Exporter<AnnotationExportDTO> = ({
  mark,
  node,
  parent,
}) => span({ mark, node, parent, types: ['span'] });

export const superscript: Exporter<AnnotationExportDTO> = ({
  mark,
  node,
  parent,
}) => span({ mark, node, parent, types: ['span'] });

export const underline: Exporter<AnnotationExportDTO> = ({
  mark,
  node,
  parent,
}) => span({ mark, node, parent, types: ['span'] });
