'use server';

import { createServerClient } from './client-ssr';
import { DataClient, TohokuCatalogEntry } from './types';
import { FolioDTO, folioFromDTO } from './types/folio';

type GetWorkFoliosArgs = {
  client: DataClient;
  uuid: string;
  toh: TohokuCatalogEntry;
  page?: number;
  size?: number;
};

export const getWorkFolios = async ({
  client,
  uuid,
  toh,
  page = 0,
  size = 10,
}: GetWorkFoliosArgs) => {
  const start = page * size;
  const end = start + size - 1;
  const { data, error } = await client
    .from('tibetan_works_folios')
    .select(
      `
      folio_uuid,
      content::text,
      volume_number::int4,
      folio_number::int4,
      side::text`,
    )
    .eq('work_uuid', uuid)
    .eq('toh', toh)
    .order('volume_number', { ascending: true })
    .order('folio_number', { ascending: true })
    .order('side', { ascending: true })
    .range(start, end);

  if (error) {
    console.error('Error fetching folios:', error);
    return [];
  }

  return data.map((dto) => folioFromDTO(dto as FolioDTO));
};

export const getFolios = async ({
  uuid,
  toh,
  page = 0,
  size = 10,
}: Omit<GetWorkFoliosArgs, 'client'>) => {
  const client = await createServerClient();
  return getWorkFolios({ client, uuid, toh, page, size });
};
