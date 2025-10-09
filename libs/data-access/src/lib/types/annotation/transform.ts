import {
  baseAnnotationFromDTO,
  type UnknownAnnotation,
  type Annotation,
  type Annotations,
  type AnnotationTransformer,
} from './annotation';
import type {
  AnnotationDTO,
  AnnotationsDTO,
  AnnotationDTOType,
} from './annotation-type';
import { ANNOTATIONS_TO_IGNORE } from './annotation-type';
import { transformer as abbreviation } from './abbreviation';
import { transformer as audio } from './audio';
import { transformer as blockquote } from './blockquote';
import { transformer as code } from './code';
import { transformer as deprecated } from './deprecated';
import { transformer as endNoteLink } from './end-note-link';
import { transformer as glossaryInstance } from './glossary-instance';
import { transformer as hasAbbreviation } from './has-abbreviation';
import { transformer as heading } from './heading';
import { transformer as image } from './image';
import { transformer as indent } from './indent';
import { transformer as inlineTitle } from './inline-title';
import { transformer as internalLink } from './internal-link';
import { transformer as leadingSpace } from './leading-space';
import { transformer as line } from './line';
import { transformer as lineGroup } from './line-group';
import { transformer as link } from './link';
import { transformer as list } from './list';
import { transformer as listItem } from './list-item';
import { transformer as mantra } from './mantra';
import { transformer as paragraph } from './paragraph';
import { transformer as quote } from './quote';
import { transformer as quoted } from './quoted';
import { transformer as reference } from './reference';
import { transformer as span } from './span';
import { transformer as trailer } from './trailer';
import { transformer as table } from './table';
import { transformer as tableBodyData } from './table-body-data';
import { transformer as tableBodyHeader } from './table-body-header';
import { transformer as tableBodyRow } from './table-body-row';
import { transformer as unknown } from './unknown';
import { annotationToDtoMap } from './export';

const dtoToAnnotationMap: Record<AnnotationDTOType, AnnotationTransformer> = {
  abbreviation,
  audio,
  blockquote,
  code,
  'deprecated-internal-link': deprecated,
  'end-note-link': endNoteLink,
  'glossary-instance': glossaryInstance,
  'has-abbreviation': hasAbbreviation,
  heading,
  image,
  indent,
  'inline-title': inlineTitle,
  'internal-link': internalLink,
  'leading-space': leadingSpace,
  line,
  'line-group': lineGroup,
  link,
  list,
  'list-item': listItem,
  mantra,
  paragraph,
  quote,
  quoted,
  reference,
  span,
  table,
  'table-body-data': tableBodyData,
  'table-body-header': tableBodyHeader,
  'table-body-row': tableBodyRow,
  trailer,
  unknown,
};

export const annotationFromDTO = (
  dto: AnnotationDTO,
  passageLength: number,
): Annotation => {
  const annotation = dtoToAnnotationMap[dto.type]?.(dto);
  if (!annotation) {
    console.warn(`Unknown annotation type: ${dto.type}`);
    console.warn(dto);
    return {
      ...baseAnnotationFromDTO(dto),
      type: 'unknown',
    } as UnknownAnnotation;
  }

  if (
    annotation.start < 0 ||
    annotation.start > passageLength ||
    annotation.end < 0 ||
    annotation.end > passageLength
  ) {
    annotation.validated = false;
  }

  if (!annotation.validated) {
    console.warn(
      `Invalid annotation range for annotation ${annotation.uuid} (${annotation.start}, ${annotation.end}) in passage of length ${passageLength}`,
    );
  }

  return annotation;
};

export const annotationsFromDTO = (
  dto?: AnnotationsDTO,
  passageLength?: number,
): Annotations => {
  const filtered =
    dto?.filter((a) => !ANNOTATIONS_TO_IGNORE.includes(a.type)) || [];
  return filtered.map((a) => annotationFromDTO(a, passageLength || 0));
};

export const annotationToDTO = (
  annotation: Annotation,
): AnnotationDTO | undefined => {
  const dto = annotationToDtoMap[annotation.type]?.(annotation);
  if (!dto) {
    console.warn(`Unknown annotation type: ${annotation.type}`);
    console.warn(annotation);
    return;
  }
  return dto;
};

export const annotationsToDTO = (annotations: Annotations): AnnotationsDTO => {
  return annotations
    .map(annotationToDTO)
    .filter((a): a is AnnotationDTO => a !== undefined);
};
