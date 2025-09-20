import { AnnotationType } from '@data-access';
import type { Node } from '@tiptap/pm/model';
import { Exporter } from './export';
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

export type AnnotationExportDTO = {
  uuid: string;
  type: AnnotationType;
  textContent: string;
  attrs?: { [key: string]: unknown };
};

const EXPORTERS: Partial<
  Record<AnnotationType | SpanMarkType | 'text', Exporter<AnnotationExportDTO>>
> = {
  abbreviation,
  audio,
  bold,
  blockquote,
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
  line: basicNode,
  lineGroup: basicNode,
  link,
  list: basicNode,
  listItem: basicNode,
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
  node: Node,
  parent: Node,
): AnnotationExportDTO[] => {
  const annotations: AnnotationExportDTO[] = [];

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

    const annotation = exporter?.({ node, parent });
    if (annotation) {
      annotations.push(annotation);
    }
  });

  return annotations;
};

export const markAnnotationFromNode = (
  node: Node,
  parent: Node,
): AnnotationExportDTO[] => {
  const annotations: AnnotationExportDTO[] = [];
  node.marks.forEach((mark) => {
    const type = mark.type.name as AnnotationType;
    const annotation = EXPORTERS[type]?.({ node, mark, parent });
    if (annotation) {
      annotations.push(annotation);
    }
  });
  return annotations;
};

export const annotationsFromNode = (
  node: Node,
  parent: Node,
): AnnotationExportDTO[] => {
  const annotations = [
    ...parameterAnnotationFromNode(node, parent),
    ...markAnnotationFromNode(node, parent),
  ];

  const blockAnnotation = EXPORTERS[node.type.name as AnnotationType]?.({
    node,
    parent,
  });

  // NOTE: passages often have a root paragraph node that does not map to an
  // annotation. Ignore nodes without a uuid.
  if (node.attrs.uuid && blockAnnotation) {
    annotations.push(blockAnnotation);
  }

  node.content.forEach((child) => {
    annotations.push(...annotationsFromNode(child, node));
  });
  return annotations;
};
