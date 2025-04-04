import {
  AnnotationDTOType,
  AnnotationType,
  annotationTypeFromDTO,
} from './annotation-type';
import { TranslationLanguage } from './language';

export type AnnotationBase = {
  end: number;
  start: number;
  type: AnnotationType;
  uuid: string;
  passageUuid: string;
};

export type AbbreviationAnnotation = AnnotationBase & {
  type: 'abbreviation';
  text: string;
};

export type BlockquoteAnnotation = AnnotationBase & {
  type: 'blockquote';
  text: string;
};

export type DistinctAnnotation = AnnotationBase & {
  type: 'distinct';
};

export type EmphasisAnnotation = AnnotationBase & {
  type: 'emphasis';
  text: string;
};

export type EndNoteAnnotation = AnnotationBase & {
  type: 'endNote';
  linkText: string;
  endNoteUuid: string;
};

export type ForeignAnnotation = AnnotationBase & {
  type: 'foreign';
  language: TranslationLanguage;
};

export type GlossaryInstanceAnnotation = AnnotationBase & {
  type: 'glossary';
  glossaryUuid: string;
};

export type HasAbbreviationAnnotation = AnnotationBase & {
  type: 'hasAbbreviation';
};

export type HeadingAnnotation = AnnotationBase & {
  type: 'heading';
  level: number;
};

export type InlineTitleAnnotation = AnnotationBase & {
  type: 'inlineTitle';
  language: TranslationLanguage;
};

export type InternalLinkAnnotation = AnnotationBase & {
  type: 'internalLink';
  href: string;
};

export type LeadingSpaceAnnotation = AnnotationBase & {
  type: 'leadingSpace';
};

export type LineAnnotation = AnnotationBase & {
  type: 'line';
};

export type LineBreakAnnotation = AnnotationBase & {
  type: 'lineBreak';
};

export type LineGroupAnnotation = AnnotationBase & {
  type: 'lineGroup';
};

export type LinkAnnotation = AnnotationBase & {
  type: 'link';
  href: string;
  text: string;
};

export type ListAnnotation = AnnotationBase & {
  type: 'list';
};

export type ListItemAnnotation = AnnotationBase & {
  type: 'listItem';
};

export type MantraAnnotation = AnnotationBase & {
  type: 'mantra';
  text: string;
};

export type ParagraphAnnotation = AnnotationBase & {
  type: 'paragraph';
};

export type ReferenceAnnotation = AnnotationBase & {
  type: 'reference';
};

export type QuotedAnnotation = AnnotationBase & {
  type: 'quoted';
  quotedUuid: string;
  // TODO: determine type for quotedType
  quotedType: string;
};

export type SmallCapsAnnotation = AnnotationBase & {
  type: 'smallCaps';
};

export type SpanAnnotation = AnnotationBase & {
  type: 'span';
};

export type SubscriptAnnotation = AnnotationBase & {
  type: 'subscript';
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

export type AnnotationDTOContentKey =
  | 'endNote_xmlId'
  | 'glossary_xmlId'
  | 'href'
  | 'lang'
  | 'level'
  | 'link-text'
  | 'paragraph'
  | 'title'
  | 'quoted_xmlId';

export type AnnotationDTOContent = Record<AnnotationDTOContentKey, unknown>;

export type AnnotationDTO = {
  content: AnnotationDTOContent[];
  end: number;
  start: number;
  type: AnnotationDTOType;
  uuid: string;
  passage_uuid: string;
};

export type AnnotationsDTO = AnnotationDTO[];

export type Annotation =
  | AbbreviationAnnotation
  | BlockquoteAnnotation
  | DistinctAnnotation
  | EmphasisAnnotation
  | EndNoteAnnotation
  | ForeignAnnotation
  | GlossaryInstanceAnnotation
  | HasAbbreviationAnnotation
  | HeadingAnnotation
  | InlineTitleAnnotation
  | InternalLinkAnnotation
  | LeadingSpaceAnnotation
  | LineAnnotation
  | LineBreakAnnotation
  | LinkAnnotation
  | LineGroupAnnotation
  | ListAnnotation
  | ListItemAnnotation
  | MantraAnnotation
  | ParagraphAnnotation
  | QuotedAnnotation
  | ReferenceAnnotation
  | SmallCapsAnnotation
  | SpanAnnotation
  | SubscriptAnnotation
  | TableBodyDataAnnotation
  | TableBodyHeaderAnnotation
  | TableBodyRowAnnotation
  | TrailerAnnotation
  | UnknownAnnotation;

export type Annotations = Annotation[];

const baseAnnotationFromDTO = (dto: AnnotationDTO): AnnotationBase => {
  return {
    uuid: dto.uuid,
    start: dto.start,
    end: dto.end,
    type: annotationTypeFromDTO(dto.type),
    passageUuid: dto.passage_uuid,
  };
};

const dtoToAnnotationMap: Record<
  AnnotationDTOType,
  (dto: AnnotationDTO) => Annotation
> = {
  abbreviation: (dto: AnnotationDTO): AbbreviationAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
    } as AbbreviationAnnotation;
  },
  blockquote: (dto: AnnotationDTO): QuotedAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
    } as QuotedAnnotation;
  },
  distinct: (dto: AnnotationDTO): DistinctAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
    } as DistinctAnnotation;
  },
  emphasis: (dto: AnnotationDTO): EmphasisAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
    } as EmphasisAnnotation;
  },
  'end-note': (dto: AnnotationDTO): EndNoteAnnotation => {
    const baseAnnotation = baseAnnotationFromDTO(dto);
    const endNote = baseAnnotation as EndNoteAnnotation;
    dto.content.forEach((content) => {
      if (content['link-text']) {
        endNote.linkText = content['link-text'] as string;
      }
      if (content.endNote_xmlId) {
        endNote.endNoteUuid = content.endNote_xmlId as string;
      }
    });

    return endNote;
  },
  foreign: (dto: AnnotationDTO): ForeignAnnotation => {
    const baseAnnotation = baseAnnotationFromDTO(dto);
    const foreignAnnotation = baseAnnotation as ForeignAnnotation;
    dto.content.forEach((content) => {
      if (content.lang) {
        foreignAnnotation.language = content.lang as TranslationLanguage;
      }
    });

    return foreignAnnotation;
  },
  'glossary-instance': (dto: AnnotationDTO): GlossaryInstanceAnnotation => {
    const glossaryInstance = baseAnnotationFromDTO(
      dto,
    ) as GlossaryInstanceAnnotation;
    dto.content.forEach((content) => {
      if (content.glossary_xmlId) {
        glossaryInstance.glossaryUuid = content.glossary_xmlId as string;
      }
    });

    return glossaryInstance;
  },
  'has-abbreviation': (dto: AnnotationDTO): HasAbbreviationAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as HasAbbreviationAnnotation;
  },
  heading: (dto: AnnotationDTO): HeadingAnnotation => {
    const heading = baseAnnotationFromDTO(dto) as HeadingAnnotation;
    dto.content.forEach((content) => {
      if (content.level) {
        heading.level = content.level as number;
      }
    });

    return heading;
  },
  'inline-title': (dto: AnnotationDTO): InlineTitleAnnotation => {
    const inlineTitle = baseAnnotationFromDTO(dto) as InlineTitleAnnotation;
    dto.content.forEach((content) => {
      if (content.lang) {
        inlineTitle.language = content.lang as TranslationLanguage;
      }
    });

    return inlineTitle;
  },
  'internal-link': (dto: AnnotationDTO): InternalLinkAnnotation => {
    const internalLink = baseAnnotationFromDTO(dto) as InternalLinkAnnotation;
    dto.content.forEach((content) => {
      if (content.href) {
        internalLink.href = content.href as string;
      }
    });

    return internalLink;
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
    const linkAnnotation = baseAnnotationFromDTO(dto) as LinkAnnotation;
    dto.content.forEach((content) => {
      if (content.title) {
        linkAnnotation.text = content.title as string;
      }

      if (content.href) {
        linkAnnotation.href = content.href as string;
      }
    });

    return linkAnnotation;
  },
  list: (dto: AnnotationDTO): ListAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as ListAnnotation;
  },
  'list-item': (dto: AnnotationDTO): ListItemAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as ListItemAnnotation;
  },
  mantra: (dto: AnnotationDTO): MantraAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
    } as MantraAnnotation;
  },
  paragraph: (dto: AnnotationDTO): ParagraphAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as ParagraphAnnotation;
  },
  quoted: (dto: AnnotationDTO): QuotedAnnotation => {
    const quotedAnnotation = baseAnnotationFromDTO(dto) as QuotedAnnotation;
    dto.content.forEach((content) => {
      if (content.quoted_xmlId) {
        quotedAnnotation.quotedType = 'passage';
        quotedAnnotation.quotedUuid = content.quoted_xmlId as string;
      }
    });

    return quotedAnnotation;
  },
  reference: (dto: AnnotationDTO): ReferenceAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as ReferenceAnnotation;
  },
  'small-caps': (dto: AnnotationDTO): SmallCapsAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as SmallCapsAnnotation;
  },
  span: (dto: AnnotationDTO): SpanAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as SpanAnnotation;
  },
  sub: (dto: AnnotationDTO): SubscriptAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as SubscriptAnnotation;
  },
  'table-body-data': (dto: AnnotationDTO): TableBodyDataAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as TableBodyDataAnnotation;
  },
  'table-body-header': (dto: AnnotationDTO): TableBodyHeaderAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as TableBodyHeaderAnnotation;
  },
  'table-body-row': (dto: AnnotationDTO): TableBodyRowAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as TableBodyRowAnnotation;
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
