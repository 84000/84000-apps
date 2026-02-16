import DataLoader from 'dataloader';
import type { AlignmentDTO, DataClient } from '@data-access';

type AlignmentRow = AlignmentDTO & { passage_uuid: string };

export function createAlignmentLoader(supabase: DataClient) {
  return new DataLoader<string, AlignmentDTO[]>(async (passageUuids) => {
    // Supabase defaults to 1000 row limit. Paginate to ensure all alignments are fetched.
    const PAGE_SIZE = 1000;
    let allData: AlignmentRow[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data, error } = await supabase
        .from('passage_alignments')
        .select(
          'passage_uuid, folio_uuid, toh, tibetan, folio_number, volume_number',
        )
        .in('passage_uuid', passageUuids as string[])
        .range(offset, offset + PAGE_SIZE - 1);

      if (error) {
        console.error('Error batch loading alignments:', error);
        // Return empty arrays for all keys on error
        return passageUuids.map(() => []);
      }

      allData = allData.concat((data ?? []) as AlignmentRow[]);
      hasMore = (data?.length ?? 0) === PAGE_SIZE;
      offset += PAGE_SIZE;
    }

    const rows = allData;

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
