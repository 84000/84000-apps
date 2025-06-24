import { AnnotationType, Annotations } from '@data-access';
import { BlockEditorContentItem } from '@design-system';
import {
  Transformer,
  audio,
  abbreviation,
  blockquote,
  deprecated,
  endNoteLink,
  glossary,
  hasAbbreviation,
  heading,
  image,
  indent,
  inlineTitle,
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
  glossary,
  hasAbbreviation,
  heading,
  indent,
  image,
  inlineTitle,
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
