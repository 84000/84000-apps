import { HeadingAnnotation } from '@data-access';
import { Exporter } from './export';

export const heading: Exporter<HeadingAnnotation> = ({
  node,
  start,
  passageUuid,
}): HeadingAnnotation | undefined => {
  const textContent = node.textContent;
  const uuid = node.attrs.uuid;
  const level = (node.attrs.level as number) || 1;
  const cls = node.attrs.class;

  if (!textContent) {
    console.warn(`Heading node ${uuid} is incomplete`);
    return undefined;
  }

  return {
    uuid,
    type: 'heading',
    passageUuid,
    start,
    end: start + textContent.length,
    level,
    class: cls,
  };
};
