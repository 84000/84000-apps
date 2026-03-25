import { MentionAnnotation } from '@eightyfourthousand/data-access';
import { Exporter } from './export';

export const mention: Exporter<MentionAnnotation[]> = ({
  node,
  start,
  passageUuid,
}): MentionAnnotation[] => {
  const items = node.attrs.items || [];

  if (items.length === 0) {
    console.warn(`Mention node on passage ${passageUuid} has no items`);
    return [];
  }

  return items.map(
    (item: {
      uuid: string;
      entity: string;
      linkType: string;
      text?: string;
      isSameWork?: boolean;
      subtype?: string;
      linkToh?: string;
    }): MentionAnnotation => ({
      uuid: item.uuid,
      type: 'mention',
      passageUuid,
      entity: item.entity,
      linkType: item.linkType,
      // Persist custom override text, but NEVER persist displayText
      ...(item.text && { text: item.text }),
      ...(item.isSameWork !== undefined && { isSameWork: item.isSameWork }),
      ...(item.subtype && { subtype: item.subtype }),
      ...(item.linkToh && { linkToh: item.linkToh }),
      // Zero-length annotation: start === end
      start,
      end: start,
    }),
  );
};
