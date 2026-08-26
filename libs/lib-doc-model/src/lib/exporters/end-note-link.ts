import {
  EndNoteLinkAnnotation,
  parseTohList,
} from '@eightyfourthousand/data-access';
import { Exporter } from './export';

export const endNoteLink: Exporter<EndNoteLinkAnnotation[]> = ({
  mark,
  node,
  start,
  passageUuid,
}): EndNoteLinkAnnotation[] => {
  const textContent = node.textContent;
  const notes = mark?.attrs.notes || [];

  if (!textContent || notes.length === 0) {
    console.warn(`Endnote link instance on passage ${passageUuid} incomplete`);
    return [];
  }

  const end = start + textContent.length;
  const annotations: EndNoteLinkAnnotation[] = notes.map(
    // One mark batches every note anchored at this point, so the toh scope is
    // per-note rather than on the mark — the central read in
    // `markAnnotationFromNode` cannot supply it.
    (note: { uuid: string; endNote: string; toh?: string }) => {
      const { uuid, endNote, toh } = note;
      const scope = parseTohList(toh);
      return {
        uuid,
        type: 'endNoteLink',
        passageUuid,
        // end note links are 0-length annotations
        start: end,
        end,
        endNote,
        ...(scope.length ? { toh: scope } : {}),
      };
    },
  );

  return annotations;
};
