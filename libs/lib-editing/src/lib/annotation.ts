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
