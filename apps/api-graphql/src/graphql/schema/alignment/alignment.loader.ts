import DataLoader from 'dataloader';
import type { AlignmentDTO, DataClient } from '@data-access';

type AlignmentRow = AlignmentDTO & { passage_uuid: string };

export function createAlignmentLoader(supabase: DataClient) {
  return new DataLoader<string, AlignmentDTO[]>(async (passageUuids) => {
    const { data, error } = await supabase
      .from('passage_alignments')
      .select(
        'passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number',
      )
      .in('passage_uuid', passageUuids as string[]);

    if (error) {
      console.error('Error batch loading alignments:', error);
      // Return empty arrays for all keys on error
      return passageUuids.map(() => []);
    }

    const rows = (data ?? []) as AlignmentRow[];

    // Group alignments by passage_uuid
    const alignmentsByPassage = new Map<string, AlignmentDTO[]>();
    for (const row of rows) {
      const passageUuid = row.passage_uuid;
      const existing = alignmentsByPassage.get(passageUuid);
      if (existing) {
        existing.push(row);
      } else {
        alignmentsByPassage.set(passageUuid, [row]);
      }
    }

    // Return in same order as input keys
    return passageUuids.map((uuid) => alignmentsByPassage.get(uuid) ?? []);
  });
}
