import {
  AnnotationType,
  Annotations,
  ExtendedTranslationLanguage,
} from '@data-access';
import type { TranslationEditorContentType, Transformer } from './transformer';
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
  table,
  tableBodyData,
  tableBodyHeader,
  tableBodyRow,
  trailer,
  unknown,
} from '.';
import type { TranslationEditorContentItem } from '../components/editor';

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
  table,
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

export const isAttributeAnnotation = (type: TranslationEditorContentType) => {
  return ['indent', 'leadingSpace', 'trailer'].includes(type);
};

export const isBlockAnnotation = (type: TranslationEditorContentType) => {
  return [
    'blockquote',
    'endnote',
    'heading',
    'line',
    'lineGroup',
    'list',
    'listItem',
    'paragraph',
    'table',
    'tableBodyData',
    'tableBodyHeader',
    'tableBodyRow',
  ].includes(type);
};

export const isInlineAnnotation = (type: TranslationEditorContentType) => {
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
  block: TranslationEditorContentItem,
  annotations: Annotations,
) => {
  for (const annotation of annotations) {
    const transformer = TRANSFORMERS[annotation.type] || TRANSFORMERS.unknown;
    transformer?.({ root: block, block, annotation });
    if (!annotation.validated) {
      if (!block.attrs) {
        block.attrs = {};
      }
      block.attrs.invalid = true;
    }
  }
};
