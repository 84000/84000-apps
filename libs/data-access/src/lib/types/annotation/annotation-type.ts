import { TohokuCatalogEntry } from '../toh';

export type AnnotationDTOType =
  | 'abbreviation'
  | 'audio'
  | 'blockquote'
  | 'code'
  | 'comment'
  | 'deprecated-internal-link'
  | 'end-note-link'
  | 'glossary-instance'
  | 'has-abbreviation'
  | 'heading'
  | 'image'
  | 'indent'
  | 'inline-title'
  | 'internal-link'
  | 'leading-space'
  | 'line'
  | 'line-group'
  | 'link'
  | 'list'
  | 'list-item'
  | 'mantra'
  | 'mention'
  | 'paragraph'
  | 'quote'
  | 'quoted'
  | 'reference'
  | 'span'
  | 'table'
  | 'table-body-data'
  | 'table-body-header'
  | 'table-body-row'
  | 'trailer'
  | 'unknown';

export type AnnotationType =
  | 'abbreviation'
  | 'audio'
  | 'blockquote'
  | 'code'
  | 'comment'
  | 'deprecated'
  | 'endNoteLink'
  | 'glossaryInstance'
  | 'hasAbbreviation'
  | 'heading'
  | 'image'
  | 'indent'
  | 'inlineTitle'
  | 'internalLink'
  | 'leadingSpace'
  | 'line'
  | 'lineGroup'
  | 'link'
  | 'list'
  | 'listItem'
  | 'mantra'
  | 'mention'
  | 'paragraph'
  | 'quote'
  | 'quoted'
  | 'reference'
  | 'span'
  | 'table'
  | 'tableBodyData'
  | 'tableBodyHeader'
  | 'tableBodyRow'
  | 'trailer'
  | 'unknown';

export const ANNOTATION_TYPE_DTO_TO_TYPE: Record<
  AnnotationDTOType,
  AnnotationType
> = {
  abbreviation: 'abbreviation',
  audio: 'audio',
  blockquote: 'blockquote',
  code: 'code',
  comment: 'comment',
  'deprecated-internal-link': 'deprecated',
  'end-note-link': 'endNoteLink',
  'glossary-instance': 'glossaryInstance',
  'has-abbreviation': 'hasAbbreviation',
  heading: 'heading',
  image: 'image',
  indent: 'indent',
  'inline-title': 'inlineTitle',
  'internal-link': 'internalLink',
  'leading-space': 'leadingSpace',
  line: 'line',
  'line-group': 'lineGroup',
  link: 'link',
  list: 'list',
  'list-item': 'listItem',
  mantra: 'mantra',
  mention: 'mention',
  paragraph: 'paragraph',
  quote: 'quote',
  quoted: 'quoted',
  reference: 'reference',
  span: 'span',
  table: 'table',
  'table-body-data': 'tableBodyData',
  'table-body-header': 'tableBodyHeader',
  'table-body-row': 'tableBodyRow',
  trailer: 'trailer',
  unknown: 'unknown',
} as const;

export const annotationTypeFromDTO = (
  type: AnnotationDTOType,
): AnnotationType => {
  return ANNOTATION_TYPE_DTO_TO_TYPE[type] || 'unknown';
};

export const ANNOTATION_TYPE_TO_DTO: Record<AnnotationType, AnnotationDTOType> =
  {
    abbreviation: 'abbreviation',
    audio: 'audio',
    blockquote: 'blockquote',
    code: 'code',
    comment: 'comment',
    deprecated: 'deprecated-internal-link',
    endNoteLink: 'end-note-link',
    glossaryInstance: 'glossary-instance',
    hasAbbreviation: 'has-abbreviation',
    heading: 'heading',
    image: 'image',
    indent: 'indent',
    inlineTitle: 'inline-title',
    internalLink: 'internal-link',
    leadingSpace: 'leading-space',
    line: 'line',
    lineGroup: 'line-group',
    link: 'link',
    list: 'list',
    listItem: 'list-item',
    mantra: 'mantra',
    mention: 'mention',
    paragraph: 'paragraph',
    quote: 'quote',
    quoted: 'quoted',
    reference: 'reference',
    span: 'span',
    table: 'table',
    tableBodyData: 'table-body-data',
    tableBodyHeader: 'table-body-header',
    tableBodyRow: 'table-body-row',
    trailer: 'trailer',
    unknown: 'unknown',
  } as const;

export type AnnotationDTOContentKey =
  | 'align'
  | 'authority'
  | 'endnote_xmlId'
  | 'glossary_xmlId'
  | 'heading-level'
  | 'heading-type'
  | 'href'
  | 'label'
  | 'lang'
  | 'link-text'
  | 'link-text-lookup'
  | 'link-type'
  | 'list-item-style'
  | 'list-spacing'
  | 'media-type'
  | 'nesting'
  | 'paragraph'
  | 'quote_xmlId'
  | 'src'
  | 'start'
  | 'end'
  | 'style'
  | 'text-style'
  | 'text'
  | 'type'
  | 'title'
  | 'uuid'
  | 'same_work'
  | 'subtype'
  | 'toh'
  | 'word-break';

export type AnnotationDTOContent = Partial<
  Record<AnnotationDTOContentKey, unknown>
>;

export type AnnotationDTO = {
  content: AnnotationDTOContent[];
  end: number;
  start: number;
  type: AnnotationDTOType;
  uuid: string;
  passage_uuid?: string;
  passageUuid?: string;
  // DB shape: a single toh or a comma-separated list, e.g. "toh417,toh418".
  toh?: string;
};

export type AnnotationsDTO = AnnotationDTO[];

export const annotationTypeToDTO = (
  type: AnnotationType,
): AnnotationDTOType => {
  return ANNOTATION_TYPE_TO_DTO[type] || 'unknown';
};

export const ANNOTATIONS_TO_IGNORE: AnnotationDTOType[] = [
  'deprecated-internal-link',
  'quoted',
  'reference',
  'unknown',
];

export type AnnotationsToIgnore = (typeof ANNOTATIONS_TO_IGNORE)[number];

/**
 * Annotations that exist only in the draft copy and must never reach a reader.
 *
 * Distinct from `ANNOTATIONS_TO_IGNORE`, which is consulted on the shared
 * DTO -> domain path *and* by the save and replace diffs: a type listed there is
 * invisible to the editor, excluded from the replace reflow, and never deleted
 * when its mark is removed. A draft-only annotation needs all three, so it is
 * filtered at the reader boundary instead — the GraphQL mapper the reading room
 * and scholar's room read through.
 *
 * A `comment` anchor points at a `comments` thread, and comments are draft-only:
 * there is no published copy of the table.
 */
export const DRAFT_ONLY_ANNOTATIONS: AnnotationDTOType[] = ['comment'];

export type AnnotationBase = {
  end: number;
  start: number;
  type: AnnotationType;
  uuid: string;
  passageUuid: string;
  validated?: boolean;
  // Tohs this annotation is scoped to; parsed from the DB's comma-separated
  // `toh` column. Empty when the annotation applies to every toh.
  toh?: TohokuCatalogEntry[];
};
