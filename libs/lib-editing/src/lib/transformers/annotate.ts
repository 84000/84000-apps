import {
  AnnotationType,
  Annotations,
  ExtendedTranslationLanguage,
} from '@data-access';
import type { BlockEditorContentWithParent, Transformer } from './transformer';
import {
  audio,
  abbreviation,
  blockquote,
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

const TRANSFORMERS: Record<AnnotationType, Transformer> = {
  abbreviation,
  audio,
  blockquote,
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

export const annotateBlock = (
  block: BlockEditorContentWithParent,
  annotations: Annotations,
) => {
  let newBlock = block;

  annotations.forEach((annotation) => {
    const transformer = TRANSFORMERS[annotation.type] || TRANSFORMERS.unknown;
    newBlock = transformer({ block: newBlock, annotation });
  });
  return newBlock;
};
