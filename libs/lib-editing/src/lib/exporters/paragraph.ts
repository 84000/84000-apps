import { ParagraphAnnotation } from '@data-access';
import { Exporter } from './export';

export const paragraph: Exporter<ParagraphAnnotation> = ({
  node,
  parent,
  start,
  passageUuid,
}): ParagraphAnnotation | undefined => {
  const uuid = node.attrs.uuid;
  const parentUuid = parent?.attrs.uuid;

  // NOTE: paragraph are often inserted as structural elements. When this happens,
  // they have the same uuid as their parent. We skip these paragraphs.
  if (uuid === parentUuid) {
    return;
  }

  const textContent = node.textContent || '';
  if (!textContent) {
    console.warn(`Paragraph ${uuid} is empty`);
    return undefined;
  }

  return {
    uuid,
    type: 'paragraph',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
