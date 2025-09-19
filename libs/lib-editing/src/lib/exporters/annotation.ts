import { AnnotationType } from '@data-access';
import type { Node } from '@tiptap/pm/model';
import { Exporter } from './export';
import { indent } from './indent';
import { leadingSpace } from './leading-space';
import { trailer } from './trailer';
import { basicMark, basicNode } from './basic';
import { paragraph } from './paragraph';
import { glossaryInstance } from './glossary-instance';

export type AnnotationExportDTO = {
  uuid: string;
  type: AnnotationType;
  textContent: string;
  attrs?: { [key: string]: unknown };
};

const EXPORTERS: Partial<
  Record<AnnotationType | 'text', Exporter<AnnotationExportDTO>>
> = {
  abbreviation: basicMark,
  audio: basicNode,
  blockquote: basicNode,
  code: basicMark,
  endNoteLink: basicNode,
  glossaryInstance,
  hasAbbreviation: basicMark,
  heading: basicNode,
  image: basicNode,
  indent,
  inlineTitle: basicMark,
  internalLink: basicMark,
  leadingSpace,
  line: basicNode,
  lineGroup: basicNode,
  link: basicMark,
  list: basicNode,
  listItem: basicNode,
  mantra: basicMark,
  paragraph,
  quote: basicMark,
  reference: basicMark,
  span: basicMark,
  tableBodyData: basicNode,
  tableBodyHeader: basicNode,
  tableBodyRow: basicNode,
  trailer,

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
