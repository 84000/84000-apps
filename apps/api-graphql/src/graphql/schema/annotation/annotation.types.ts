/**
 * Map database annotation types (kebab-case) to GraphQL enum values
 */
export const ANNOTATION_DTO_TYPE_TO_ENUM: Record<string, string> = {
  abbreviation: 'ABBREVIATION',
  audio: 'AUDIO',
  blockquote: 'BLOCKQUOTE',
  code: 'CODE',
  'deprecated-internal-link': 'DEPRECATED',
  'end-note-link': 'END_NOTE_LINK',
  'glossary-instance': 'GLOSSARY_INSTANCE',
  'has-abbreviation': 'HAS_ABBREVIATION',
  heading: 'HEADING',
  image: 'IMAGE',
  indent: 'INDENT',
  'inline-title': 'INLINE_TITLE',
  'internal-link': 'INTERNAL_LINK',
  'leading-space': 'LEADING_SPACE',
  line: 'LINE',
  'line-group': 'LINE_GROUP',
  link: 'LINK',
  list: 'LIST',
  'list-item': 'LIST_ITEM',
  mantra: 'MANTRA',
  paragraph: 'PARAGRAPH',
  quote: 'QUOTE',
  quoted: 'QUOTED',
  reference: 'REFERENCE',
  span: 'SPAN',
  table: 'TABLE',
  'table-body-data': 'TABLE_BODY_DATA',
  'table-body-header': 'TABLE_BODY_HEADER',
  'table-body-row': 'TABLE_BODY_ROW',
  trailer: 'TRAILER',
  unknown: 'UNKNOWN',
};

/**
 * Map language codes to GraphQL Language enum values
 */
export const LANG_TO_ENUM: Record<string, string> = {
  Bo: 'BO',
  'Bo-Ltn': 'BO_LTN',
  en: 'EN',
  'Sa-Ltn': 'SA_LTN',
  zh: 'ZH',
  'Pi-Ltn': 'PI_LTN',
};

/**
 * Map heading type values to GraphQL HeadingClass enum values
 */
export const HEADING_CLASS_TO_ENUM: Record<string, string> = {
  'section-label': 'SECTION_LABEL',
  'section-title': 'SECTION_TITLE',
  supplementary: 'SUPPLEMENTARY',
  'table-label': 'TABLE_LABEL',
};
