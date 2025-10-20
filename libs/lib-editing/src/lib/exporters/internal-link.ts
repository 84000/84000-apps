import { InternalLinkAnnotation } from '@data-access';
import { Exporter } from './export';

export const internalLink: Exporter<InternalLinkAnnotation> = ({
  mark,
  node,
  start,
  passageUuid,
}): InternalLinkAnnotation | undefined => {
  const textContent = node.textContent;
  const linkType = mark?.attrs.type;
  const entity = mark?.attrs.entity;
  const uuid = mark?.attrs.uuid;
  const href = mark?.attrs.href;
  const isPending = mark?.attrs.isPending;

  if (!textContent || !entity || !linkType || !uuid) {
    console.warn(
      `Internal link ${uuid} on pasage ${passageUuid} is incomplete`,
    );
    return undefined;
  }

  return {
    uuid,
    type: 'internalLink',
    passageUuid,
    linkType,
    entity,
    href,
    isPending,
    start,
    end: start + textContent.length,
  };
};
