import { Annotation, AnnotationType } from '@data-access';
import { Exporter, ExporterContext } from './export';
import { abbreviation } from './abbreviation';
import { audio } from './audio';
import { blockquote } from './blockquote';
import { code } from './code';
import { endNoteLink } from './end-note-link';
import { glossaryInstance } from './glossary-instance';
import { hasAbbreviation } from './has-abbreviation';
import { heading } from './heading';
import { image } from './image';
import { indent } from './indent';
import { internalLink } from './internal-link';
import { italic } from './italic';
import { leadingSpace } from './leading-space';
import { line } from './line';
import { lineGroup } from './line-group';
import { link } from './link';
import { listItem } from './list-item';
import { list } from './list';
import { paragraph } from './paragraph';
import { quote } from './quote';
import { span } from './span';
import { trailer } from './trailer';
import { table } from './table';
import { tableBodyData } from './table-body-data';
import { tableBodyHeader } from './table-body-header';
import { tableBodyRow } from './table-body-row';
import { SpanMarkType } from '../types';
import { findNodePosition, nodeNotFound } from './util';

const EXPORTERS: Partial<
  Record<
    | AnnotationType
    | SpanMarkType
    | 'text'
    | 'bulletList'
    | 'tableCell'
    | 'tableHeader'
    | 'tableRow',
    Exporter<Annotation>
  >
> = {
  abbreviation,
  audio,
  bold: span,
  blockquote,
  bulletList: list,
  code,
  endNoteLink,
  glossaryInstance,
  hasAbbreviation,
  heading,
  image,
  indent,
  inlineTitle: italic,
  internalLink,
  italic,
  leadingSpace,
  line,
  lineGroup,
  link,
  listItem,
  mantra: italic,
  paragraph,
  quote,
  reference: link,
  smallCaps: span,
  subscript: span,
  superscript: span,
  table,
  tableCell: tableBodyData,
  tableHeader: tableBodyHeader,
  tableRow: tableBodyRow,
  trailer,
  underline: span,

  // ignored types
  deprecated: undefined,
  quoted: undefined,
  unknown: undefined,
  text: undefined,
};

const PARAMETER_ANNOTATION_MAP: { [key: string]: AnnotationType } = {
  hasIndent: 'indent',
  hasLeadingSpace: 'leadingSpace',
  hasTrailer: 'trailer',
};

export const parameterAnnotationFromNode = (
  ctx: ExporterContext,
): Annotation[] => {
  const annotations: Annotation[] = [];
  const { node, start } = ctx;

  const keys = Object.keys(PARAMETER_ANNOTATION_MAP);
  keys.forEach((key) => {
    const annotType = PARAMETER_ANNOTATION_MAP[key];
    const exporter = EXPORTERS[annotType];
    const hasAttr = !!node.attrs[key];
    if (!hasAttr) {
      return;
    }

    if (!exporter) {
      console.warn(`No exporter for parameter annotation: ${key}`);
    }

    const annotation = exporter?.({ ...ctx, start });
    if (annotation) {
      annotations.push(annotation);
    }
  });

  return annotations;
};

export const markAnnotationFromNode = (ctx: ExporterContext): Annotation[] => {
  const { node } = ctx;
  const annotations: Annotation[] = [];
  node.marks.forEach((mark) => {
    const start = findNodePosition(ctx.root, mark.attrs.uuid, mark.type.name);
    if (start === undefined) {
      return nodeNotFound(mark);
    }
    const type = mark.type.name as AnnotationType;
    const annotation = EXPORTERS[type]?.({ ...ctx, mark, start });
    if (annotation) {
      annotations.push(annotation);
    }
  });
  return annotations;
};

export const annotationExportsFromNode = (
  ctx: ExporterContext,
): Annotation[] => {
  const { node, root } = ctx;
  const annotations = [
    ...parameterAnnotationFromNode(ctx),
    ...markAnnotationFromNode(ctx),
  ];

  const blockAnnotation = EXPORTERS[node.type.name as AnnotationType]?.(ctx);

  // NOTE: passages often have a root paragraph node that does not map to an
  // annotation. Ignore nodes without a uuid.
  if (node.attrs.uuid && blockAnnotation) {
    annotations.push(blockAnnotation);
  }

  node.content.forEach((child) => {
    const start = findNodePosition(root, child.attrs.uuid, child.type.name);
    if (start === undefined) {
      return nodeNotFound(child);
    }
    annotations.push(
      ...annotationExportsFromNode({
        ...ctx,
        node: child,
        parent: node,
        start,
      }),
    );
  });
  return annotations;
};
