import {
  MentionAnnotation,
  parseTohList,
} from '@eightyfourthousand/data-access';
import { Exporter } from './export';

/** A mention item's own toh scope, in annotation form; empty when unscoped. */
const tohScope = (toh?: string): Pick<MentionAnnotation, 'toh'> | object => {
  const scope = parseTohList(toh);
  return scope.length ? { toh: scope } : {};
};

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
      // The annotation's own toh scope. Distinct from `linkToh`, which scopes
      // the mention's *target*. One mention node batches several annotations,
      // so this is per-item and the central export read cannot supply it.
      toh?: string;
      lang?: MentionAnnotation['lang'];
      style?: MentionAnnotation['style'];
      highlightStart?: number;
      highlightEnd?: number;
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
      ...tohScope(item.toh),
      ...(item.lang && { lang: item.lang }),
      ...(item.style && { style: item.style }),
      ...(item.highlightStart !== undefined && {
        highlightStart: item.highlightStart,
      }),
      ...(item.highlightEnd !== undefined && {
        highlightEnd: item.highlightEnd,
      }),
      // Zero-length annotation: start === end
      start,
      end: start,
    }),
  );
};
