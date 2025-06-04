export type AnnotationDTOType =
  | 'abbreviation'
  | 'audio'
  | 'blockquote'
  | 'end-note-link'
  | 'glossary-instance'
  | 'has-abbreviation'
  | 'heading'
  | 'image'
  | 'inline-title'
  | 'internal-link'
  | 'leading-space'
  | 'line'
  | 'line-group'
  | 'link'
  | 'list'
  | 'list-item'
  | 'mantra'
  | 'paragraph'
  | 'quote'
  | 'quoted'
  | 'reference'
  | 'span'
  | 'table-body-data'
  | 'table-body-header'
  | 'table-body-row'
  | 'trailer'
  | 'unknown';

export type AnnotationType =
  | 'abbreviation'
  | 'audio'
  | 'blockquote'
  | 'endNoteLink'
  | 'glossary'
  | 'hasAbbreviation'
  | 'heading'
  | 'image'
  | 'inlineTitle'
  | 'internalLink'
  | 'leadingSpace'
  | 'line'
  | 'lineGroup'
  | 'link'
  | 'list'
  | 'listItem'
  | 'mantra'
  | 'paragraph'
  | 'quote'
  | 'quoted'
  | 'reference'
  | 'span'
  | 'tableBodyData'
  | 'tableBodyHeader'
  | 'tableBodyRow'
  | 'trailer'
  | 'unknown';

const ANNOATION_TYPE_DTO_TO_TYPE: Record<AnnotationDTOType, AnnotationType> = {
  abbreviation: 'abbreviation',
  audio: 'audio',
  blockquote: 'blockquote',
  'end-note-link': 'endNoteLink',
  'glossary-instance': 'glossary',
  'has-abbreviation': 'hasAbbreviation',
  heading: 'heading',
  image: 'image',
  'inline-title': 'inlineTitle',
  'internal-link': 'internalLink',
  'leading-space': 'leadingSpace',
  line: 'line',
  'line-group': 'lineGroup',
  link: 'link',
  list: 'list',
  'list-item': 'listItem',
  mantra: 'mantra',
  paragraph: 'paragraph',
  quote: 'quote',
  quoted: 'quoted',
  reference: 'reference',
  span: 'span',
  'table-body-data': 'tableBodyData',
  'table-body-header': 'tableBodyHeader',
  'table-body-row': 'tableBodyRow',
  trailer: 'trailer',
  unknown: 'unknown',
} as const;

export const ANNOTATIONS_TO_IGNORE: AnnotationDTOType[] = [
  'has-abbreviation',
  'leading-space',
  'paragraph',
  'quoted',
  'reference',
  'span',
  'unknown',
];

export const annotationTypeFromDTO = (
  type: AnnotationDTOType,
): AnnotationType => {
  return ANNOATION_TYPE_DTO_TO_TYPE[type] || 'unknown';
};
