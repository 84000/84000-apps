import {
  AnnotationType,
  Annotations,
  ExtendedTranslationLanguage,
} from '@eightyfourthousand/data-access';
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
  mention,
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
  mention,
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
  'Mt-Ltn',
  'Pi-Ltn',
  'Sa-Ltn',
  'Zh-Ltn',
] as const;

export const isAttributeAnnotation = (type: TranslationEditorContentType) => {
  return ['indent', 'leadingSpace'].includes(type);
};

export const isBlockAnnotation = (type: TranslationEditorContentType) => {
  return [
    'blockquote',
    'endnotes',
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
    'trailer',
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
    'mention',
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
    if (annotation.validated) {
      const transformer = TRANSFORMERS[annotation.type] || TRANSFORMERS.unknown;
      transformer?.({ root: block, block, annotation });
    } else {
      // Applying an out-of-range annotation would clamp its markup onto the
      // wrong text and then persist the fabricated range on the next save.
      console.warn(
        `skipping invalid annotation ${annotation.uuid} (${annotation.type}) on passage ${annotation.passageUuid}`,
      );
    }

    // Checked again (not folded into the else) so a transformer that flips
    // validated to false mid-flight still flags the passage.
    if (!annotation.validated) {
      if (!block.attrs) {
        block.attrs = {};
      }
      block.attrs.invalid = true;
    }
  }
};
