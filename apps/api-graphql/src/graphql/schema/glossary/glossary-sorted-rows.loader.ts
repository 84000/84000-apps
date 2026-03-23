import DataLoader from 'dataloader';
import type { DataClient } from '@data-access';

export type GlossaryRow = {
  uuid: string;
  work_uuid: string;
  authority_uuid: string;
  definition: string | null;
  definition_rend: string | null;
  name_uuid: string;
  attestation: string | null;
};

export type SortedGlossaryRow = GlossaryRow & {
  englishName: string;
  termNumber: number;
};

const PAGE_SIZE = 1000;
const IN_BATCH_SIZE = 300;

/**
 * Creates a DataLoader that caches the deduplicated, sorted glossary rows
 * per work UUID within a single request. This avoids re-fetching and re-sorting
 * the full glossary list on every paginated request.
 */
export function createSortedGlossaryRowsLoader(supabase: DataClient) {
  return new DataLoader<string, SortedGlossaryRow[]>(
    async (workUuids) => {
      return Promise.all(
        workUuids.map((workUuid) =>
          fetchDeduplicatedSortedRows(supabase, workUuid),
        ),
      );
    },
    { cache: true },
  );
}

async function fetchDeduplicatedSortedRows(
  supabase: DataClient,
  workUuid: string,
): Promise<SortedGlossaryRow[]> {
  // 1. Fetch all glossary rows, paginating past the default row limit
  const glossaryRows: GlossaryRow[] = [];
  let offset = 0;
  let hasMoreRows = true;

  while (hasMoreRows) {
    const { data, error } = await supabase
      .from('glossaries')
      .select(
        'uuid, work_uuid, authority_uuid, definition, definition_rend, name_uuid, attestation',
      )
      .eq('work_uuid', workUuid)
      .eq('termType', 'translationMain')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error || !data) {
      console.error('Error fetching glossary rows:', error);
      return [];
    }

    glossaryRows.push(...(data as GlossaryRow[]));
    hasMoreRows = data.length === PAGE_SIZE;
    offset += PAGE_SIZE;
  }

  // 2. Fetch English names by name_uuid, batched to stay within URL limits
  const uniqueNameUuids = [...new Set(glossaryRows.map((g) => g.name_uuid))];
  const nameResults: Array<{
    uuid: string;
    authority_uuid: string;
    content: string;
  }> = [];

  for (let i = 0; i < uniqueNameUuids.length; i += IN_BATCH_SIZE) {
    const batch = uniqueNameUuids.slice(i, i + IN_BATCH_SIZE);
    const { data: nameData, error: nameError } = await supabase
      .from('names')
      .select('uuid, authority_uuid, content')
      .in('uuid', batch)
      .eq('language', 'en');

    if (nameError) {
      console.error('Error fetching English names batch:', nameError);
    }

    nameResults.push(
      ...(
        (nameData ?? []) as Array<{
          uuid: string;
          authority_uuid: string;
          content: string;
        }>
      ),
    );
  }

  // 3. Build authority -> English name map
  const englishByAuthority = new Map<string, string>();
  for (const n of nameResults) {
    if (!englishByAuthority.has(n.authority_uuid)) {
      englishByAuthority.set(n.authority_uuid, n.content);
    }
  }

  // 4. Deduplicate by authority_uuid
  const byAuthority = new Map<string, GlossaryRow>();
  for (const row of glossaryRows) {
    if (!byAuthority.has(row.authority_uuid)) {
      byAuthority.set(row.authority_uuid, row);
    }
  }

  // 5. Sort by English name with UUID tiebreak
  const withNames = [...byAuthority.values()].map((row) => ({
    ...row,
    englishName: (
      englishByAuthority.get(row.authority_uuid) ?? ''
    ).toLowerCase(),
    termNumber: 0,
  }));

  withNames.sort((a, b) => {
    const cmp = a.englishName.localeCompare(b.englishName);
    return cmp !== 0 ? cmp : a.uuid.localeCompare(b.uuid);
  });

  // 6. Assign term numbers (1-based)
  for (let i = 0; i < withNames.length; i++) {
    withNames[i].termNumber = i + 1;
  }

  return withNames;
}
