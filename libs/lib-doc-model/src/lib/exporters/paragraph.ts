import {
  ParagraphAnnotation,
  normalizeAlign,
  normalizeWordBreak,
} from '@eightyfourthousand/data-access';
import { Exporter } from './export';
import { holdsOnlyAtoms } from './util';
import { isStructuralParagraph } from '../structural';

export const paragraph: Exporter<ParagraphAnnotation> = ({
  node,
  parent,
  start,
  passageUuid,
}): ParagraphAnnotation | undefined => {
  const uuid = node.attrs.uuid;
  const parentUuid = parent?.attrs.uuid;

  // A paragraph sharing its parent's uuid is structural and has no row. One
  // sharing the passage's is too, unless it carries attributes to save: a
  // per-passage document has no passage node for it to share a uuid with.
  if (uuid === parentUuid || isStructuralParagraph(node, passageUuid)) {
    return;
  }

  const textContent = node.textContent || '';
  // As with `line`, a paragraph holding only inline atoms marks a break the
  // editor drew and persists as a zero-length annotation.
  if (!textContent && !holdsOnlyAtoms(node)) {
    console.warn(`Paragraph ${uuid} is empty`);
    return undefined;
  }

  const align = normalizeAlign(node.attrs.textAlign);
  const wordBreak = normalizeWordBreak(node.attrs.wordBreak);

  return {
    uuid,
    type: 'paragraph',
    passageUuid,
    start,
    end: start + textContent.length,
    ...(align ? { align } : {}),
    ...(wordBreak ? { wordBreak } : {}),
  };
};
