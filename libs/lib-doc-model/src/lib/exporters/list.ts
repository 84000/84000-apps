import { ListAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';

export const list: Exporter<ListAnnotation> = ({
  node,
  start,
  passageUuid,
}): ListAnnotation | undefined => {
  const textContent = node.textContent || '';
  const uuid = node.attrs.uuid;

  if (!textContent) {
    console.warn(`List ${uuid} is empty`);
    return undefined;
  }

  const spacing = node.attrs.spacing;
  const nesting = (node.attrs.nesting as number) || 0;
  const itemStyle = node.attrs.itemStyle;

  return {
    uuid,
    type: 'list',
    passageUuid,
    start,
    end: start + textContent.length,
    spacing,
    nesting,
    itemStyle,
  };
};

/**
 * A numbered list made in the editor. It is stored as a `list` with numbered
 * items, which is how it loads back.
 */
export const orderedList: Exporter<ListAnnotation> = (ctx) => {
  const annotation = list(ctx);
  return annotation && { ...annotation, itemStyle: 'numbers' };
};
