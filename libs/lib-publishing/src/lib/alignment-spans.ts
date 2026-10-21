/**
 * Recorded passage alignments as spans of folio sides, for one placement (Toh) of a
 * work. Read from the alignment table, not the `passage_alignments` view built on it,
 * because only the table carries the end side's uuid.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { readKeyset } from './snapshot/paging';

/** One recorded alignment of a passage to a run of folio sides. */
export interface AlignmentSpan {
  uuid: string;
  passageUuid: string | null;
  startFolioUuid: string;
  endFolioUuid: string;
  /** Characters of the end side the passage covers; 0 means none of it. */
  endCharacterPosition: number | null;
}

interface SpanRow extends Record<string, unknown> {
  uuid: string;
  passage_uuid: string | null;
  start_folio_uuid: string | null;
  end_folio_uuid: string | null;
  end_character_position: number | null;
}

/** The alignment table keys a Toh without its prefix: `toh312` is `312`. */
export const bareToh = (toh: string): string => toh.replace(/^toh/i, '');

/** Every alignment recorded for one placement of a work, such as `toh312`. */
export const readAlignmentSpans = async (
  client: DataClient,
  toh: string,
): Promise<AlignmentSpan[]> => {
  const rows = await readKeyset<SpanRow>({
    build: () =>
      client
        .from('folio_annotations_passage_alignments')
        .select(
          'uuid, passage_uuid, start_folio_uuid, end_folio_uuid, end_character_position',
        )
        .eq('toh', bareToh(toh)),
    idColumn: 'uuid',
    what: 'alignment spans',
  });
  return rows.flatMap((row) =>
    row.start_folio_uuid && row.end_folio_uuid
      ? [
          {
            uuid: row.uuid,
            passageUuid: row.passage_uuid,
            startFolioUuid: row.start_folio_uuid,
            endFolioUuid: row.end_folio_uuid,
            endCharacterPosition: row.end_character_position,
          },
        ]
      : [],
  );
};

/**
 * Which sides, given by uuid in reading order, hold aligned Tibetan. A side counts when
 * any alignment starts on it, ends on it, or runs across it; an alignment that ends at
 * character 0 of a later side does not reach that side. `unplaced` counts alignments
 * whose start or end side is not among `sideUuids`.
 */
export const markAlignedSides = (
  sideUuids: readonly string[],
  spans: readonly AlignmentSpan[],
): { aligned: boolean[]; unplaced: number } => {
  const index = new Map(sideUuids.map((uuid, i) => [uuid, i]));
  // A difference array: +1 where a span starts, -1 just past where it ends.
  const delta = new Array<number>(sideUuids.length + 1).fill(0);
  let unplaced = 0;
  for (const span of spans) {
    const start = index.get(span.startFolioUuid);
    let end = index.get(span.endFolioUuid);
    if (start === undefined || end === undefined) {
      unplaced++;
      continue;
    }
    if (end > start && span.endCharacterPosition === 0) end--;
    delta[Math.min(start, end)]++;
    delta[Math.max(start, end) + 1]--;
  }
  const aligned: boolean[] = [];
  let open = 0;
  for (let i = 0; i < sideUuids.length; i++) {
    open += delta[i];
    aligned.push(open > 0);
  }
  return { aligned, unplaced };
};
