import { TranslationLanguage } from './language';

export type AnnotationType =
  | 'distinct'
  | 'end-note'
  | 'foreign'
  | 'glossary-instance'
  | 'inline-title'
  | 'internal-link'
  | 'leading-space'
  | 'line'
  | 'line-group'
  | 'link'
  | 'paragraph'
  | 'quoted'
  | 'small-caps'
  | 'unknown';

export type AnnotationBase = {
  content: unknown[];
  end: number;
  start: number;
  type: AnnotationType;
  uuid: string;
  passageXmlId?: string;
};

export type EndNoteXmlIdContent = {
  endNoteXmlId: string;
};

export type GlossaryXmlIdContent = {
  glossaryXmlId: string;
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

export type UnknownAnnotation = AnnotationBase & {
  type: 'unknown';
  content: [];
};

export type AnnotationDTOContentKey =
  | 'endNote_xmlId'
  | 'glossary_xmlId'
  | 'href'
  | 'lang'
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
  passage_xmlId?: string;
};

export type AnnotationsDTO = AnnotationDTO[];

export type Annotation =
  | DistinctAnnotation
  | EndNoteAnnotation
  | ForeignAnnotation
  | GlossaryInstanceAnnotation
  | InlineTitleAnnotation
  | InternalLinkAnnotation
  | LeadingSpaceAnnotation
  | LineAnnotation
  | LinkAnnotation
  | LineGroupAnnotation
  | ParagraphAnnotation
  | QuotedAnnotation
  | SmallCapsAnnotation
  | UnknownAnnotation;

export type Annotations = Annotation[];

const dtoToAnnotationMap: Record<
  AnnotationType,
  (dto: AnnotationDTO) => Annotation
> = {
  distinct: (dto: AnnotationDTO): DistinctAnnotation => {
    return {
      ...dto,
      content: [],
    } as DistinctAnnotation;
  },
  'end-note': (dto: AnnotationDTO): EndNoteAnnotation => {
    const endNoteXmlId = dto.content[0]?.endNote_xmlId;
    const content = endNoteXmlId ? [{ endNoteXmlId }] : [];
    return {
      ...dto,
      content,
    } as EndNoteAnnotation;
  },
  foreign: (dto: AnnotationDTO): ForeignAnnotation => {
    const language = dto.content[0]?.lang;
    const content = language ? [{ language }] : [];
    return {
      ...dto,
      content,
    } as ForeignAnnotation;
  },
  'glossary-instance': (dto: AnnotationDTO): GlossaryInstanceAnnotation => {
    const glossaryXmlId = dto.content[0]?.glossary_xmlId;
    const content = glossaryXmlId ? [{ glossaryXmlId }] : [];
    return {
      ...dto,
      content,
    } as GlossaryInstanceAnnotation;
  },
  'inline-title': (dto: AnnotationDTO): InlineTitleAnnotation => {
    const language = dto.content[0]?.lang;
    const content = language ? [{ language }] : [];
    return {
      ...dto,
      content,
    } as InlineTitleAnnotation;
  },
  'internal-link': (dto: AnnotationDTO): InternalLinkAnnotation => {
    const href = dto.content[0]?.href;
    const content = href ? [{ href }] : [];
    return {
      ...dto,
      content,
    } as InternalLinkAnnotation;
  },
  'leading-space': (dto: AnnotationDTO): LeadingSpaceAnnotation => {
    return {
      ...dto,
      content: [],
    } as LeadingSpaceAnnotation;
  },
  line: (dto: AnnotationDTO): LineAnnotation => {
    return {
      ...dto,
      content: [],
    } as LineAnnotation;
  },
  link: (dto: AnnotationDTO): LinkAnnotation => {
    const href = dto.content[0]?.href;
    const title = dto.content[1]?.title;
    const content = href && title ? [{ href }, { title }] : [];
    return {
      ...dto,
      content,
    } as LinkAnnotation;
  },
  'line-group': (dto: AnnotationDTO): LineGroupAnnotation => {
    return {
      ...dto,
      content: [],
    } as LineGroupAnnotation;
  },
  paragraph: (dto: AnnotationDTO): ParagraphAnnotation => {
    return {
      ...dto,
      content: [],
    } as ParagraphAnnotation;
  },
  quoted: (dto: AnnotationDTO): QuotedAnnotation => {
    const quotedXmlId = dto.content[0]?.quoted_xmlId;
    const content = quotedXmlId ? [{ quotedXmlId }] : [];
    return {
      ...dto,
      content,
    } as QuotedAnnotation;
  },
  'small-caps': (dto: AnnotationDTO): SmallCapsAnnotation => {
    return {
      ...dto,
      content: [],
    } as SmallCapsAnnotation;
  },
  unknown: (dto: AnnotationDTO): UnknownAnnotation => {
    return {
      ...dto,
      content: [],
    } as UnknownAnnotation;
  },
};

export const annotationFromDTO = (dto: AnnotationDTO): Annotation => {
  const annotation = dtoToAnnotationMap[dto.type]?.(dto);
  if (!annotation) {
    return {
      ...dto,
      content: [],
      type: 'unknown',
    } as UnknownAnnotation;
  }
  return annotation;
};

export const annotationsFromDTO = (dto: AnnotationsDTO): Annotations => {
  return dto.map(annotationFromDTO);
};
