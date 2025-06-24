export type AnnotationDTOType =
  | 'abbreviation'
  | 'audio'
  | 'blockquote'
  | 'deprecated-internal-link'
  | 'end-note-link'
  | 'glossary-instance'
  | 'has-abbreviation'
  | 'heading'
  | 'image'
  | 'indent'
  | 'inline-title'
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
  | 'deprecated'
  | 'endNoteLink'
  | 'glossary'
  | 'hasAbbreviation'
  | 'heading'
  | 'image'
  | 'indent'
  | 'inlineTitle'
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
  'deprecated-internal-link': 'deprecated',
  'end-note-link': 'endNoteLink',
  'glossary-instance': 'glossary',
  'has-abbreviation': 'hasAbbreviation',
  heading: 'heading',
  image: 'image',
  indent: 'indent',
  'inline-title': 'inlineTitle',
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
  'deprecated-internal-link',
  'has-abbreviation',
  'quoted',
  'reference',
  'unknown',
];

export type AnnotationsToIgnore = (typeof ANNOTATIONS_TO_IGNORE)[number];

export const annotationTypeFromDTO = (
  type: AnnotationDTOType,
): AnnotationType => {
  return ANNOATION_TYPE_DTO_TO_TYPE[type] || 'unknown';
};
