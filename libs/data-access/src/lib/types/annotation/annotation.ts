import { ExtendedTranslationLanguage } from '../language';
import {
  AnnotationBase,
  AnnotationDTO,
  annotationTypeFromDTO,
  annotationTypeToDTO,
} from './annotation-type';

export type AbbreviationAnnotation = AnnotationBase & {
  type: 'abbreviation';
  abbreviation: string;
};

export type AudioAnnotation = AnnotationBase & {
  type: 'audio';
  src: string;
  mediaType: string;
};

export type BlockquoteAnnotation = AnnotationBase & {
  type: 'blockquote';
};

export type CodeAnnotation = AnnotationBase & {
  type: 'code';
};

export type DeprecatedAnnotation = AnnotationBase & {
  type: 'deprecated';
};

export type EndNoteLinkAnnotation = AnnotationBase & {
  type: 'endNoteLink';
  endNote: string;
};

export type GlossaryInstanceAnnotation = AnnotationBase & {
  type: 'glossaryInstance';
  glossary: string;
};

export type HasAbbreviationAnnotation = AnnotationBase & {
  type: 'hasAbbreviation';
  abbreviation: string;
};

export type HeadingClass =
  | 'section-label'
  | 'section-title'
  | 'supplementary'
  | 'table-label';

export type HeadingAnnotation = AnnotationBase & {
  type: 'heading';
  level: number;
  class?: HeadingClass;
};

export type ImageAnnotation = AnnotationBase & {
  type: 'image';
  src: string;
};

export type IndentAnnotation = AnnotationBase & {
  type: 'indent';
};

export type InlineTitleAnnotation = AnnotationBase & {
  type: 'inlineTitle';
  lang: ExtendedTranslationLanguage;
};

export type InternalLinkAnnotation = AnnotationBase & {
  type: 'internalLink';
  linkType: string;
  href?: string;
  label?: string;
  uuid?: string;
  isPending: boolean;
};

export type LeadingSpaceAnnotation = AnnotationBase & {
  type: 'leadingSpace';
};

export type LineGroupAnnotation = AnnotationBase & {
  type: 'lineGroup';
};

export type LineAnnotation = AnnotationBase & {
  type: 'line';
};

export type LinkAnnotation = AnnotationBase & {
  type: 'link';
  href: string;
  text: string;
};

export type ListItemAnnotation = AnnotationBase & {
  type: 'listItem';
};

export type ListAnnotation = AnnotationBase & {
  type: 'list';
  spacing?: string;
  nesting?: number;
  itemStyle?: string;
};

export type MantraAnnotation = AnnotationBase & {
  type: 'mantra';
  lang: ExtendedTranslationLanguage;
};

export type ParagraphAnnotation = AnnotationBase & {
  type: 'paragraph';
};

export type QuoteAnnotation = AnnotationBase & {
  type: 'quote';
  quote?: string;
};

export type QuotedAnnotation = AnnotationBase & {
  type: 'quoted';
  quote?: string;
};

export type ReferenceAnnotation = AnnotationBase & {
  type: 'reference';
};

export type SpanAnnotation = AnnotationBase & {
  type: 'span';
  textStyle?: string;
  lang?: ExtendedTranslationLanguage;
};

export type TableBodyDataAnnotation = AnnotationBase & {
  type: 'tableBodyData';
};

export type TableBodyHeaderAnnotation = AnnotationBase & {
  type: 'tableBodyHeader';
};

export type TableBodyRowAnnotation = AnnotationBase & {
  type: 'tableBodyRow';
};

export type TrailerAnnotation = AnnotationBase & {
  type: 'trailer';
};

export type UnknownAnnotation = AnnotationBase & {
  type: 'unknown';
};

export type AnnotationTransformer = (dto: AnnotationDTO) => Annotation;

export const baseAnnotationFromDTO = (dto: AnnotationDTO): AnnotationBase => {
  const passageUuid = dto.passage_uuid || dto.passageUuid || '';

  return {
    uuid: dto.uuid,
    start: dto.start,
    end: dto.end,
    type: annotationTypeFromDTO(dto.type),
    passageUuid,
  };
};

export type AnnotationExporter = (annotation: Annotation) => AnnotationDTO;

export const baseAnnotationToDto = (
  annotation: AnnotationBase,
): AnnotationDTO => ({
  end: annotation.end,
  start: annotation.start,
  type: annotationTypeToDTO(annotation.type),
  uuid: annotation.uuid,
  passageUuid: annotation.passageUuid,
  content: [],
});

export type Annotation =
  | AbbreviationAnnotation
  | AudioAnnotation
  | BlockquoteAnnotation
  | CodeAnnotation
  | DeprecatedAnnotation
  | EndNoteLinkAnnotation
  | GlossaryInstanceAnnotation
  | HasAbbreviationAnnotation
  | HeadingAnnotation
  | ImageAnnotation
  | IndentAnnotation
  | InlineTitleAnnotation
  | InternalLinkAnnotation
  | LeadingSpaceAnnotation
  | LineAnnotation
  | LineGroupAnnotation
  | LinkAnnotation
  | ListAnnotation
  | ListItemAnnotation
  | MantraAnnotation
  | ParagraphAnnotation
  | QuoteAnnotation
  | QuotedAnnotation
  | ReferenceAnnotation
  | SpanAnnotation
  | TableBodyDataAnnotation
  | TableBodyHeaderAnnotation
  | TableBodyRowAnnotation
  | TrailerAnnotation
  | UnknownAnnotation;

export type Annotations = Annotation[];
