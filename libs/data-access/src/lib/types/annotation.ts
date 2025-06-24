import {
  ANNOTATIONS_TO_IGNORE,
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

export type AudioAnnotation = AnnotationBase & {
  type: 'audio';
  src: string;
  mediaType: string;
};

export type DeprecatedAnnotation = AnnotationBase & {
  type: 'deprecated';
};

export type BlockquoteAnnotation = AnnotationBase & {
  type: 'blockquote';
  text: string;
};

export type EndNoteLinkAnnotation = AnnotationBase & {
  type: 'endNoteLink';
};

export type GlossaryInstanceAnnotation = AnnotationBase & {
  type: 'glossary';
  uuid: string;
};

export type HasAbbreviationAnnotation = AnnotationBase & {
  type: 'hasAbbreviation';
};

export type HeadingAnnotation = AnnotationBase & {
  type: 'heading';
  level: number;
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
  language: TranslationLanguage;
};

export type InternalLinkAnnotation = AnnotationBase & {
  type: 'internalLink';
  href: string;
  text?: string;
  isPending: boolean;
};

export type LeadingSpaceAnnotation = AnnotationBase & {
  type: 'leadingSpace';
};

export type LineAnnotation = AnnotationBase & {
  type: 'line';
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

export type QuoteAnnotation = AnnotationBase & {
  type: 'quote';
  uuid?: string;
};

export type QuotedAnnotation = AnnotationBase & {
  type: 'quoted';
  uuid?: string;
};

export type ReferenceAnnotation = AnnotationBase & {
  type: 'reference';
};

export type SpanAnnotation = AnnotationBase & {
  type: 'span';
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
  | 'href'
  | 'lang'
  | 'level'
  | 'link-text'
  | 'link-type'
  | 'media-type'
  | 'paragraph'
  | 'src'
  | 'title'
  | 'uuid';

export type AnnotationDTOContent = Record<AnnotationDTOContentKey, unknown>;

export type AnnotationDTO = {
  content: AnnotationDTOContent[];
  end: number;
  start: number;
  type: AnnotationDTOType;
  uuid: string;
  passage_uuid?: string;
  passageUuid?: string;
};

export type AnnotationsDTO = AnnotationDTO[];

export type Annotation =
  | AbbreviationAnnotation
  | AudioAnnotation
  | BlockquoteAnnotation
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

const baseAnnotationFromDTO = (dto: AnnotationDTO): AnnotationBase => {
  const passageUuid = dto.passage_uuid || dto.passageUuid || '';

  return {
    uuid: dto.uuid,
    start: dto.start,
    end: dto.end,
    type: annotationTypeFromDTO(dto.type),
    passageUuid,
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
  audio: (dto: AnnotationDTO): AudioAnnotation => {
    const baseAnnotation = baseAnnotationFromDTO(dto);
    const audio = baseAnnotation as AudioAnnotation;
    dto.content.forEach((content) => {
      if (content.src) {
        audio.src = content.src as string;
      }
      if (content['media-type']) {
        audio.mediaType = content['media-type'] as string;
      }
    });

    return audio;
  },
  blockquote: (dto: AnnotationDTO): QuotedAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
    } as QuotedAnnotation;
  },
  'deprecated-internal-link': (dto: AnnotationDTO): DeprecatedAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
    } as DeprecatedAnnotation;
  },
  'end-note-link': (dto: AnnotationDTO): EndNoteLinkAnnotation => {
    const baseAnnotation = baseAnnotationFromDTO(dto);
    const endNote = baseAnnotation as EndNoteLinkAnnotation;
    dto.content.forEach((content) => {
      if (content.uuid) {
        endNote.uuid = content.uuid as string;
      }
    });

    return endNote;
  },
  'glossary-instance': (dto: AnnotationDTO): GlossaryInstanceAnnotation => {
    const glossaryInstance = baseAnnotationFromDTO(
      dto,
    ) as GlossaryInstanceAnnotation;
    dto.content.forEach((content) => {
      if (content.uuid) {
        glossaryInstance.uuid = content.uuid as string;
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
  image: (dto: AnnotationDTO): ImageAnnotation => {
    const baseAnnotation = baseAnnotationFromDTO(dto);
    const image = baseAnnotation as ImageAnnotation;
    dto.content.forEach((content) => {
      if (content.src) {
        image.src = content.src as string;
      }
    });

    return image;
  },
  indent: (dto: AnnotationDTO): IndentAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
    } as IndentAnnotation;
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

      if (content['link-text']) {
        internalLink.text = content['link-text'] as string;
      }

      if (content['link-type']) {
        internalLink.isPending = true;
      }
    });

    return internalLink;
  },
  'leading-space': (dto: AnnotationDTO) => {
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
  quote: (dto: AnnotationDTO): QuoteAnnotation => {
    const quotedAnnotation = baseAnnotationFromDTO(dto) as QuoteAnnotation;
    dto.content.forEach((content) => {
      if (content.uuid) {
        quotedAnnotation.uuid = content.uuid as string;
      }
    });

    return quotedAnnotation;
  },
  quoted: (dto: AnnotationDTO): QuotedAnnotation => {
    const quotedAnnotation = baseAnnotationFromDTO(dto) as QuotedAnnotation;
    dto.content.forEach((content) => {
      if (content.uuid) {
        quotedAnnotation.uuid = content.uuid as string;
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
  span: (dto: AnnotationDTO): SpanAnnotation => {
    return {
      ...baseAnnotationFromDTO(dto),
      content: [],
    } as SpanAnnotation;
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
  const filtered =
    dto?.filter((a) => !ANNOTATIONS_TO_IGNORE.includes(a.type)) || [];
  return filtered.map(annotationFromDTO);
};
