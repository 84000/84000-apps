import { AnnotationType } from '@data-access';
import { Exporter, ExporterContext } from './export';
import { AnnotationExportDTO } from './annotation';

const ITALIC_TYPES: AnnotationType[] = ['inlineTitle', 'mantra', 'span'];

export const span = ({
  mark,
  node,
  parent,
  start,
  types,
}: ExporterContext & { types: AnnotationType[] }):
  | AnnotationExportDTO
  | undefined => {
  const type = mark?.attrs.type;
  const uuid = mark?.attrs.uuid;
  const textStyle = mark?.attrs.textStyle;

  if (!types.includes(type as AnnotationType)) {
    console.warn(`Span mark ${uuid} has invalid type: ${type}`);
    console.log({ node: node.attrs, mark: mark?.attrs });
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
    start,
    end: start + textContent.length,
    attrs: {
      lang,
      textStyle,
    },
  };
};

export const bold: Exporter<AnnotationExportDTO> = (ctx) =>
  span({ ...ctx, types: ['span'] });

export const italic: Exporter<AnnotationExportDTO> = (ctx) =>
  span({ ...ctx, types: ITALIC_TYPES });

export const smallCaps: Exporter<AnnotationExportDTO> = (ctx) =>
  span({ ...ctx, types: ['span'] });

export const subscript: Exporter<AnnotationExportDTO> = (ctx) =>
  span({ ...ctx, types: ['span'] });

export const superscript: Exporter<AnnotationExportDTO> = (ctx) =>
  span({ ...ctx, types: ['span'] });

export const underline: Exporter<AnnotationExportDTO> = (ctx) =>
  span({ ...ctx, types: ['span'] });
