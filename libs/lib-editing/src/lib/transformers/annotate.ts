import {
  AnnotationType,
  Annotations,
  ExtendedTranslationLanguage,
} from '@data-access';
import type { BlockEditorContentType, Transformer } from './transformer';
import {
  audio,
  abbreviation,
  blockquote,
  code,
  deprecated,
  endNoteLink,
  glossaryInstance,
  hasAbbreviation,
  heading,
  image,
  indent,
  inlineTitle,
  internalLink,
  leadingSpace,
  lineGroup,
  line,
  link,
  list,
  listItem,
  mantra,
  paragraph,
  quote,
  quoted,
  reference,
  span,
  tableBodyData,
  tableBodyHeader,
  tableBodyRow,
  trailer,
  unknown,
} from '.';
import type { BlockEditorContentItem } from '@design-system';

const TRANSFORMERS: Partial<Record<AnnotationType, Transformer>> = {
  abbreviation,
  audio,
  blockquote,
  code,
  deprecated,
  endNoteLink,
  glossaryInstance,
  hasAbbreviation,
  heading,
  indent,
  image,
  inlineTitle,
  internalLink,
  leadingSpace,
  line,
  lineGroup,
  link,
  list,
  listItem,
  mantra,
  paragraph,
  quote,
  quoted,
  reference,
  span,
  tableBodyData,
  tableBodyHeader,
  tableBodyRow,
  trailer,
  unknown,
} as const;

export const ITALIC_LANGUAGES: ExtendedTranslationLanguage[] = [
  'en',
  'Bo-Ltn',
  'Pi-Ltn',
  'Sa-Ltn',
] as const;

export const isAttributeAnnotation = (type: BlockEditorContentType) => {
  return ['indent', 'leadingSpace', 'trailer'].includes(type);
};

export const isBlockAnnotation = (type: BlockEditorContentType) => {
  return [
    'blockquote',
    'heading',
    'line',
    'lineGroup',
    'list',
    'listItem',
    'paragraph',
    'tableBodyData',
    'tableBodyHeader',
    'tableBodyRow',
  ].includes(type);
};

export const isInlineAnnotation = (type: BlockEditorContentType) => {
  return [
    'abbreviation',
    'audio',
    'code',
    'endNoteLink',
    'glossaryInstance',
    'hasAbbreviation',
    'image',
    'italic',
    'inlineTitle',
    'internalLink',
    'link',
    'mantra',
    'quote',
    'quoted',
    'reference',
    'span',
    'text',
  ].includes(type);
};

export const annotateBlock = (
  block: BlockEditorContentItem,
  annotations: Annotations,
) => {
  for (const annotation of annotations) {
    const transformer = TRANSFORMERS[annotation.type] || TRANSFORMERS.unknown;
    transformer?.({ root: block, block, annotation });
  }
};
