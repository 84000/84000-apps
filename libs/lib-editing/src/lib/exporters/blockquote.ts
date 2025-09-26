import { BlockquoteAnnotation } from '@data-access';
import { Exporter } from './export';

export const blockquote: Exporter<BlockquoteAnnotation> = ({
  node,
  start,
  passageUuid,
}): BlockquoteAnnotation | undefined => {
  const textContent = node.textContent;
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`Blockquote node ${uuid} is missing body text`);
    return undefined;
  }

  return {
    uuid,
    type: 'blockquote',
    passageUuid,
    start,
    end: start + textContent.length,
  };
};
