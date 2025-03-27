import { TranslationLanguage } from './language';

export type AnnotationType =
  | 'distinct'
  | 'end-note'
  | 'foreign'
  | 'glossary-instance'
  | 'heading'
  | 'inline-title'
  | 'internal-link'
  | 'leading-space'
  | 'line'
  | 'line-group'
  | 'line-break'
  | 'link'
  | 'paragraph'
  | 'quoted'
  | 'small-caps'
  | 'trailer'
  | 'unknown';

export type AnnotationBase = {
  content: unknown[];
  end: number;
  start: number;
  type: AnnotationType;
  uuid: string;
  passageUuid: string;
};

export type EndNoteXmlIdContent = {
  endNoteXmlId: string;
};

export type GlossaryXmlIdContent = {
  glossaryXmlId: string;
};

export type HeadingContent = {
  level: number;
};

export type PassageXmlIdContent = {
  passageXmlId: string;
};

export type QuotedXmlIdContent = {
  quotedXmlId: string;
};

export type TranslationLanguageContent = {
  language: TranslationLanguage;
};

export type LinkContent = {
  href: string;
};

export type TitleContent = {
  title: string;
};

export type DistinctAnnotation = AnnotationBase & {
  type: 'distinct';
  content: [];
};

export type EndNoteAnnotation = AnnotationBase & {
  type: 'end-note';
  content: [EndNoteXmlIdContent] | [];
};

export type ForeignAnnotation = AnnotationBase & {
  type: 'foreign';
  content: [TranslationLanguageContent] | [];
};

export type GlossaryInstanceAnnotation = AnnotationBase & {
  type: 'glossary-instance';
  content: [GlossaryXmlIdContent] | [];
};

export type HeadingAnnotation = AnnotationBase & {
  type: 'heading';
  content: [HeadingContent] | [];
};

export type InlineTitleAnnotation = AnnotationBase & {
  type: 'inline-title';
  content: [TranslationLanguageContent] | [];
};

export type InternalLinkAnnotation = AnnotationBase & {
  type: 'internal-link';
  content: [LinkContent] | [];
};

export type LeadingSpaceAnnotation = AnnotationBase & {
  type: 'leading-space';
  content: [];
};

export type LineAnnotation = AnnotationBase & {
  type: 'line';
  content: [];
};

export type LineBreakAnnotation = AnnotationBase & {
  type: 'line-break';
  content: [];
};

export type LinkAnnotation = AnnotationBase & {
  type: 'link';
  content: [LinkContent, TitleContent] | [];
};

export type LineGroupAnnotation = AnnotationBase & {
  type: 'line-group';
  content: [];
};

export type ParagraphAnnotation = AnnotationBase & {
  type: 'paragraph';
  content: [];
};

export type QuotedAnnotation = AnnotationBase & {
  type: 'quoted';
  content: [QuotedXmlIdContent] | [];
};

export type SmallCapsAnnotation = AnnotationBase & {
  type: 'small-caps';
  content: [];
};

export type TrailerAnnotation = AnnotationBase & {
  type: 'trailer';
  content: [];
};

export type UnknownAnnotation = AnnotationBase & {
  type: 'unknown';
  content: [];
};

export type AnnotationDTOContentKey =
  | 'endNote_xmlId'
  | 'glossary_xmlId'
  | 'href'
  | 'lang'
  | 'level'
  | 'paragraph'
  | 'title'
  | 'quoted_xmlId';

export type AnnotationDTOContent = Record<AnnotationDTOContentKey, unknown>;

export type AnnotationDTO = {
  content: AnnotationDTOContent[];
  end: number;
  start: number;
  type: AnnotationType;
  uuid: string;
  passage_uuid: string;
};

export type AnnotationsDTO = AnnotationDTO[];

export type Annotation =
  | DistinctAnnotation
  | EndNoteAnnotation
  | ForeignAnnotation
  | GlossaryInstanceAnnotation
  | HeadingAnnotation
  | InlineTitleAnnotation
  | InternalLinkAnnotation
  | LeadingSpaceAnnotation
  | LineAnnotation
  | LineBreakAnnotation
  | LinkAnnotation
  | LineGroupAnnotation
  | ParagraphAnnotation
  | QuotedAnnotation
  | SmallCapsAnnotation
  | TrailerAnnotation
  | UnknownAnnotation;

export type Annotations = Annotation[];

const baseAnnotationFromDTO = (dto: AnnotationDTO): AnnotationBase => {
  return {
    uuid: dto.uuid,
    start: dto.start,
    end: dto.end,
    type: dto.type,
    passageUuid: dto.passage_uuid,
    content: [],
  };
};

const dtoToAnnotationMap: Record<
  AnnotationType,
  (dto: AnnotationDTO) => Annotation
> = {
  distinct: (dto: AnnotationDTO): DistinctAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as DistinctAnnotation;
  },
  'end-note': (dto: AnnotationDTO): EndNoteAnnotation => {
    const endNoteXmlId = dto.content[0]?.endNote_xmlId;
    const content = endNoteXmlId ? [{ endNoteXmlId }] : [];
    return {
      ...baseAnnotationFromDTO(dto),
      content,
    } as EndNoteAnnotation;
  },
  foreign: (dto: AnnotationDTO): ForeignAnnotation => {
    const language = dto.content[0]?.lang;
    const content = language ? [{ language }] : [];
    return {
      ...baseAnnotationFromDTO(dto),
      content,
    } as ForeignAnnotation;
  },
  'glossary-instance': (dto: AnnotationDTO): GlossaryInstanceAnnotation => {
    const glossaryXmlId = dto.content[0]?.glossary_xmlId;
    const content = glossaryXmlId ? [{ glossaryXmlId }] : [];
    return {
      ...baseAnnotationFromDTO(dto),
      content,
    } as GlossaryInstanceAnnotation;
  },
  heading: (dto: AnnotationDTO): HeadingAnnotation => {
    const levelStr = dto.content[0]?.level as string;
    const level = Number(levelStr) || 1;
    return {
      ...baseAnnotationFromDTO(dto),
      content: [{ level }],
    } as HeadingAnnotation;
  },
  'inline-title': (dto: AnnotationDTO): InlineTitleAnnotation => {
    const language = dto.content[0]?.lang;
    const content = language ? [{ language }] : [];
    return {
      ...baseAnnotationFromDTO(dto),
      content,
    } as InlineTitleAnnotation;
  },
  'internal-link': (dto: AnnotationDTO): InternalLinkAnnotation => {
    const href = dto.content[0]?.href;
    const content = href ? [{ href }] : [];
    return {
      ...baseAnnotationFromDTO(dto),
      content,
    } as InternalLinkAnnotation;
  },
  'leading-space': (dto: AnnotationDTO): LeadingSpaceAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as LeadingSpaceAnnotation;
  },
  line: (dto: AnnotationDTO): LineAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as LineAnnotation;
  },
  'line-break': (dto: AnnotationDTO): LineBreakAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as LineBreakAnnotation;
  },
  'line-group': (dto: AnnotationDTO): LineGroupAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as LineGroupAnnotation;
  },
  link: (dto: AnnotationDTO): LinkAnnotation => {
    const href = dto.content[0]?.href;
    const title = dto.content[1]?.title;
    const content = href && title ? [{ href }, { title }] : [];
    return {
      ...baseAnnotationFromDTO(dto),
      content,
    } as LinkAnnotation;
  },
  paragraph: (dto: AnnotationDTO): ParagraphAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as ParagraphAnnotation;
  },
  quoted: (dto: AnnotationDTO): QuotedAnnotation => {
    const quotedXmlId = dto.content[0]?.quoted_xmlId;
    const content = quotedXmlId ? [{ quotedXmlId }] : [];
    return {
      ...baseAnnotationFromDTO(dto),
      content,
    } as QuotedAnnotation;
  },
  'small-caps': (dto: AnnotationDTO): SmallCapsAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as SmallCapsAnnotation;
  },
  trailer: (dto: AnnotationDTO): TrailerAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as TrailerAnnotation;
  },
  unknown: (dto: AnnotationDTO): UnknownAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as UnknownAnnotation;
  },
};

export const annotationFromDTO = (dto: AnnotationDTO): Annotation => {
  const annotation = dtoToAnnotationMap[dto.type]?.(dto);
  if (!annotation) {
    console.warn(`Unknown annotation type: ${dto.type}`);
    console.warn(dto);
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
      type: 'unknown',
    } as UnknownAnnotation;
  }
  return annotation;
};

export const annotationsFromDTO = (dto?: AnnotationsDTO): Annotations => {
  return dto?.map(annotationFromDTO) || [];
};
