export const MARK_TYPES = [
  'bold',
  'italic',
  'smallCaps',
  'subscript',
  'superscript',
  'underline',
];

export type SpanMarkType = (typeof MARK_TYPES)[number];
