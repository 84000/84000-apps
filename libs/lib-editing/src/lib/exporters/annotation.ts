import { AnnotationType } from '@data-access';
import { Exporter, ExporterContext } from './export';
import { indent } from './indent';
import { leadingSpace } from './leading-space';
import { trailer } from './trailer';
import { basicMark, basicNode } from './basic';
import { paragraph } from './paragraph';
import { glossaryInstance } from './glossary-instance';
import { abbreviation } from './abbreviation';
import { audio } from './audio';
import { image } from './image';
import { blockquote } from './blockquote';
import { code } from './code';
import { endNoteLink } from './end-note-link';
import { hasAbbreviation } from './has-abbreviation';
import { heading } from './heading';
import { SpanMarkType } from '../types';
import {
  bold,
  italic,
  smallCaps,
  subscript,
  superscript,
  underline,
} from './span';
import { link } from './link';
import { line } from './line';
import { lineGroup } from './line-group';
import { listItem } from './list-item';
import { list } from './list';
import { findNodePosition, nodeNotFound } from './util';

export type AnnotationExportDTO = {
  uuid: string;
  type: AnnotationType;
  textContent: string;
  attrs?: { [key: string]: unknown };
  start: number;
  end: number;
};

const EXPORTERS: Partial<
  Record<
    AnnotationType | SpanMarkType | 'text' | 'ul',
    Exporter<AnnotationExportDTO>
  >
> = {
  abbreviation,
  audio,
  bold,
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
  internalLink: link,
  italic,
  leadingSpace,
  line,
  lineGroup,
  link,
  listItem,
  mantra: italic,
  paragraph,
  quote: basicMark,
  reference: link,
  smallCaps,
  subscript,
  superscript,
  tableBodyData: basicNode,
  tableBodyHeader: basicNode,
  tableBodyRow: basicNode,
  trailer,
  underline,

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
): AnnotationExportDTO[] => {
  const annotations: AnnotationExportDTO[] = [];
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

export const markAnnotationFromNode = (
  ctx: ExporterContext,
): AnnotationExportDTO[] => {
  const { node } = ctx;
  const annotations: AnnotationExportDTO[] = [];
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

export const annotationsFromNode = (
  ctx: ExporterContext,
): AnnotationExportDTO[] => {
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
      ...annotationsFromNode({
        ...ctx,
        node: child,
        parent: node,
        start,
      }),
    );
  });
  return annotations;
};
