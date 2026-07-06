'use server';

import { createServerClient } from './client-ssr';
import { DataClient, TohokuCatalogEntry } from './types';
import { Folio, FolioDTO, FoliosAround, folioFromDTO } from './types/folio';

type GetWorkFoliosArgs = {
  client: DataClient;
  uuid: string;
  toh: TohokuCatalogEntry;
  page?: number;
  size?: number;
  /**
   * Absolute offset into the ordered folio list. When provided, takes
   * precedence over `page` (which is otherwise `page * size`).
   */
  offset?: number;
};

export const getWorkFolios = async ({
  client,
  uuid,
  toh,
  page = 0,
  size = 10,
  offset,
}: GetWorkFoliosArgs) => {
  const start = offset ?? page * size;
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

type GetWorkFoliosAroundArgs = {
  client: DataClient;
  uuid: string;
  toh: TohokuCatalogEntry;
  folioUuid: string;
  before?: number;
  after?: number;
};

/**
 * Fetch a window of folios centered on a target folio, plus flags indicating
 * whether more folios exist before/after the window. Returns `null` when the
 * folio isn't part of the work/toh.
 */
export const getWorkFoliosAround = async ({
  client,
  uuid,
  toh,
  folioUuid,
  before = 10,
  after = 10,
}: GetWorkFoliosAroundArgs): Promise<FoliosAround | null> => {
  // Resolve the target folio's position within the ordered list. Selecting
  // only the uuid keeps this cheap even for works with many folios.
  const { data, error } = await client
    .from('tibetan_works_folios')
    .select('folio_uuid')
    .eq('work_uuid', uuid)
    .eq('toh', toh)
    .order('volume_number', { ascending: true })
    .order('folio_number', { ascending: true })
    .order('side', { ascending: true });

  if (error) {
    console.error('Error fetching folio index:', error);
    return null;
  }

  const total = data.length;
  const index = data.findIndex((row) => row.folio_uuid === folioUuid);
  if (index === -1) {
    return null;
  }

  const startIndex = Math.max(0, index - before);
  const endIndex = Math.min(total - 1, index + after);

  const folios = await getWorkFolios({
    client,
    uuid,
    toh,
    offset: startIndex,
    size: endIndex - startIndex + 1,
  });

  return {
    folios,
    startIndex,
    hasMoreBefore: startIndex > 0,
    hasMoreAfter: endIndex < total - 1,
  };
};

type FolioLocation = {
  workUuid: string;
  folioUuid: string;
  toh: TohokuCatalogEntry;
};

/**
 * Resolve a single folio by its UUID to its parent work + toh. Used by entity
 * lookup to build a deep link into the work's source tab.
 */
export const getFolioLocation = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}): Promise<FolioLocation | null> => {
  const { data, error } = await client
    .from('tibetan_works_folios')
    .select('work_uuid, folio_uuid, toh')
    .eq('folio_uuid', uuid)
    .single();

  if (error || !data) {
    console.error('Error fetching folio location:', error);
    return null;
  }

  return {
    workUuid: data.work_uuid as string,
    folioUuid: data.folio_uuid as string,
    toh: data.toh as TohokuCatalogEntry,
  };
};

/**
 * Batch-fetch folios by their UUIDs, returning a map keyed by folio UUID.
 * Used by the GraphQL folio DataLoader to resolve folio mention display text.
 */
export const getFoliosByUuids = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids: readonly string[];
}): Promise<Map<string, Folio>> => {
  const foliosByUuid = new Map<string, Folio>();

  if (uuids.length === 0) {
    return foliosByUuid;
  }

  const { data, error } = await client
    .from('folios')
    .select(
      `
      folio_uuid:uuid::uuid,
      content::text,
      volume_number::int4,
      folio_number::int4,
      side::text`,
    )
    .in('uuid', uuids);

  if (error) {
    console.error('Error fetching folios by uuids:', error);
    return foliosByUuid;
  }

  for (const dto of data) {
    const folio = folioFromDTO(dto as FolioDTO);
    foliosByUuid.set(folio.uuid, folio);
  }

  return foliosByUuid;
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
