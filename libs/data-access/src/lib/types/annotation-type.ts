export type AnnotationDTOType =
  | 'abbreviation'
  | 'blockquote'
  | 'distinct'
  | 'end-note'
  | 'end-note-link'
  | 'emphasis'
  | 'foreign'
  | 'glossary-instance'
  | 'has-abbreviation'
  | 'heading'
  | 'inline-title'
  | 'internal-link'
  | 'leading-space'
  | 'line'
  | 'line-group'
  | 'line-break'
  | 'link'
  | 'list'
  | 'list-item'
  | 'mantra'
  | 'paragraph'
  | 'quoted'
  | 'reference'
  | 'small-caps'
  | 'span'
  | 'sub'
  | 'table-body-data'
  | 'table-body-header'
  | 'table-body-row'
  | 'trailer'
  | 'unknown';

export type AnnotationType =
  | 'abbreviation'
  | 'blockquote'
  | 'distinct'
  | 'emphasis'
  | 'endNote'
  | 'endNoteLink'
  | 'foreign'
  | 'glossary'
  | 'hasAbbreviation'
  | 'heading'
  | 'inlineTitle'
  | 'internalLink'
  | 'leadingSpace'
  | 'line'
  | 'lineGroup'
  | 'lineBreak'
  | 'link'
  | 'list'
  | 'listItem'
  | 'mantra'
  | 'paragraph'
  | 'quoted'
  | 'reference'
  | 'smallCaps'
  | 'span'
  | 'subscript'
  | 'tableBodyData'
  | 'tableBodyHeader'
  | 'tableBodyRow'
  | 'trailer'
  | 'unknown';

const ANNOATION_TYPE_DTO_TO_TYPE: Record<AnnotationDTOType, AnnotationType> = {
  abbreviation: 'abbreviation',
  blockquote: 'blockquote',
  distinct: 'distinct',
  'end-note': 'endNote',
  'end-note-link': 'endNoteLink',
  emphasis: 'emphasis',
  foreign: 'foreign',
  'glossary-instance': 'glossary',
  'has-abbreviation': 'hasAbbreviation',
  heading: 'heading',
  'inline-title': 'inlineTitle',
  'internal-link': 'internalLink',
  'leading-space': 'leadingSpace',
  line: 'line',
  'line-group': 'lineGroup',
  'line-break': 'lineBreak',
  link: 'link',
  list: 'list',
  'list-item': 'listItem',
  mantra: 'mantra',
  paragraph: 'paragraph',
  quoted: 'quoted',
  reference: 'reference',
  'small-caps': 'smallCaps',
  span: 'span',
  sub: 'subscript',
  'table-body-data': 'tableBodyData',
  'table-body-header': 'tableBodyHeader',
  'table-body-row': 'tableBodyRow',
  trailer: 'trailer',
  unknown: 'unknown',
} as const;

export const annotationTypeFromDTO = (
  type: AnnotationDTOType,
): AnnotationType => {
  return ANNOATION_TYPE_DTO_TO_TYPE[type] || 'unknown';
};
