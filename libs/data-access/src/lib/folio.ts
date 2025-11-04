'use server';

import { createServerClient } from './client-ssr';
import { TohokuCatalogEntry } from './types';
import { FolioDTO, folioFromDTO } from './types/folio';

export const getFolios = async ({
  uuid,
  toh,
  page = 0,
  size = 10,
}: {
  uuid: string;
  toh: TohokuCatalogEntry;
  page?: number;
  size?: number;
}) => {
  const start = page * size;
  const end = start + size - 1;
  const client = await createServerClient();
  const { data, error } = await client
    .from('tibetan_works_folios')
    .select(
      `
      content::text,
      volume_number::int4,
      folio_number::int4,
      side::text`,
    )
    .eq('work_uuid', uuid)
    .eq('toh', toh)
    .order('folio_number', { ascending: true })
    .order('side', { ascending: true })
    .range(start, end);

  if (error) {
    console.error('Error fetching folios:', error);
    return [];
  }

  return data.map((dto) => folioFromDTO(dto as FolioDTO));
};
