import { AnnotationType, Annotations } from '@data-access';
import { BlockEditorContentItem } from '@design-system';
import {
  Transformer,
  abbreviation,
  blockquote,
  distinct,
  emphasis,
  endNote,
  foreign,
  glossary,
  hasAbbreviation,
  heading,
  inlineTitle,
  internalLink,
  leadingSpace,
  lineBreak,
  lineGroup,
  line,
  link,
  list,
  listItem,
  mantra,
  paragraph,
  quoted,
  reference,
  smallCaps,
  span,
  subscript,
  tableBodyData,
  tableBodyHeader,
  tableBodyRow,
  trailer,
  unknown,
} from './transformers';

const ANNOTATIONS_TO_IGNORE = [
  'abbreviation',
  'hasAbbreviation',
  'quoted',
  'unknown',
  'leadingSpace',
  'reference',
  'span',
  'unknown',
];

const BLOCK_ANNOTATIONS = [
  'blockquote',
  'heading',
  // 'line',
  // 'lineBreak',
  // 'lineGroup',
  // 'list',
  // 'listItem',
  'paragraph',
  'tableBodyData',
  'tableBodyHeader',
  'tableBodyRow',
];

const MARK_ANNOTATIONS = [
  'distinct',
  'endNote',
  'emphasis',
  'foreign',
  'glossary',
  'inlineTitle',
  'internalLink',
  'link',
  'mantra',
  'subscript',
  'trailer',
];

const ANNOTATION_TYPE_TO_MARK: Record<
  (typeof MARK_ANNOTATIONS)[number],
  string
> = {
  distinct: 'italic',
  emphasis: 'italic',
  endNote: 'italic',
  foreign: 'italic',
  glossary: 'link',
  inlineTitle: 'italic',
  internalLink: 'link',
  link: 'link',
  mantra: 'italic',
  subscript: 'italic',
  trailer: 'italic',
};

const ANNOTATION_TYPE_TO_BLOCK: Record<
  (typeof BLOCK_ANNOTATIONS)[number],
  string
> = {
  blockquote: 'blockquote',
  heading: 'heading',
  // line: 'listItem',
  // lineGroup: 'list',
  // list: 'list',
  // listItem: 'listItem',
  paragraph: 'paragraph',
  tableBodyData: 'tableCell',
  tableBodyHeader: 'tableHeader',
  tableBodyRow: 'tableyRow',
};

const TRANSFORMERS: Record<AnnotationType, Transformer> = {
  abbreviation,
  blockquote,
  distinct,
  emphasis,
  endNote,
  foreign,
  glossary,
  hasAbbreviation,
  heading,
  inlineTitle,
  internalLink,
  leadingSpace,
  line,
  lineBreak,
  lineGroup,
  link,
  list,
  listItem,
  mantra,
  paragraph,
  quoted,
  reference,
  smallCaps,
  span,
  subscript,
  tableBodyData,
  tableBodyHeader,
  tableBodyRow,
  trailer,
  unknown,
} as const;

export const annotateBlock = (
  block: BlockEditorContentItem,
  annotations: Annotations,
) => {
  let newBlock = block;

  annotations.forEach((annotation) => {
    const transformer = TRANSFORMERS[annotation.type] || TRANSFORMERS.unknown;
    newBlock = transformer({ block: newBlock, annotation });
  });
  return newBlock;
};
