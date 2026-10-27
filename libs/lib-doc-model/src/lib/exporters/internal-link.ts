import { InternalLinkAnnotation } from '@eightyfourthousand/data-access';
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
  const linkStatus = mark?.attrs.linkStatus;
  const label = mark?.attrs.label;
  const isSameWork = mark?.attrs.isSameWork;
  const subtype = mark?.attrs.subtype;
  const linkToh = mark?.attrs.linkToh;

  // Older links carry only an href (no target entity), and still persist.
  if (!textContent || !uuid) {
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
    ...(linkStatus ? { linkStatus, isPending: true } : {}),
    ...(typeof label === 'string' ? { label } : {}),
    ...(typeof isSameWork === 'boolean' ? { isSameWork } : {}),
    ...(subtype ? { subtype } : {}),
    ...(linkToh ? { linkToh } : {}),
    start,
    end: start + textContent.length,
  };
};
