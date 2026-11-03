'use server';

import { createServerClient } from './client-ssr';
import { DataClient, TohokuCatalogEntry } from './types';
import {
  Folio,
  FolioDTO,
  FolioSide,
  FoliosAround,
  folioFromDTO,
} from './types/folio';

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

type FolioPosition = {
  volume_number: number;
  folio_number: number;
  side: string;
};

const FOLIO_POSITION_COLUMNS = `
  volume_number::int4,
  folio_number::int4,
  side::text`;

type FoliosAroundPositionArgs = Omit<GetWorkFoliosAroundArgs, 'folioUuid'> & {
  position: FolioPosition;
};

/**
 * Window the work's folios around a folio's position in reading order. The
 * index is counted rather than found in a read of every folio, which PostgREST
 * would truncate at its row limit.
 */
const getWorkFoliosAroundPosition = async ({
  client,
  uuid,
  toh,
  position,
  before = 10,
  after = 10,
}: FoliosAroundPositionArgs): Promise<FoliosAround | null> => {
  const { volume_number: volume, folio_number: folio, side } = position;
  const { count: index, error } = await client
    .from('tibetan_works_folios')
    .select('folio_uuid', { count: 'exact', head: true })
    .eq('work_uuid', uuid)
    .eq('toh', toh)
    .or(
      [
        `volume_number.lt.${volume}`,
        `and(volume_number.eq.${volume},folio_number.lt.${folio})`,
        `and(volume_number.eq.${volume},folio_number.eq.${folio},side.lt.${side})`,
      ].join(','),
    );

  if (error || index === null) {
    console.error('Error counting folios:', error);
    return null;
  }

  const startIndex = Math.max(0, index - before);
  const size = index + after - startIndex + 1;

  // One folio past the window says whether more follow, without a total count.
  const folios = await getWorkFolios({
    client,
    uuid,
    toh,
    offset: startIndex,
    size: size + 1,
  });

  return {
    folios: folios.slice(0, size),
    startIndex,
    hasMoreBefore: startIndex > 0,
    hasMoreAfter: folios.length > size,
  };
};

/**
 * Fetch a window of folios centered on a target folio, plus flags indicating
 * whether more folios exist before/after the window. Returns `null` when the
 * folio isn't part of the work/toh.
 */
export const getWorkFoliosAround = async ({
  folioUuid,
  ...args
}: GetWorkFoliosAroundArgs): Promise<FoliosAround | null> => {
  const { data, error } = await args.client
    .from('tibetan_works_folios')
    .select(FOLIO_POSITION_COLUMNS)
    .eq('work_uuid', args.uuid)
    .eq('toh', args.toh)
    .eq('folio_uuid', folioUuid)
    .limit(1);

  if (error) {
    console.error('Error resolving folio position:', error);
    return null;
  }

  const position = data?.[0] as FolioPosition | undefined;
  if (!position) {
    return null;
  }

  return getWorkFoliosAroundPosition({ ...args, position });
};

type GetWorkFoliosAtArgs = {
  client: DataClient;
  uuid: string;
  toh: TohokuCatalogEntry;
  folioNumber: number;
  side: FolioSide;
  /**
   * Pins the volume when a folio number recurs across volumes. Omitted, the
   * lowest-numbered volume wins; every returned folio reports its own `volume`,
   * so a caller can see which it got rather than having to assume.
   */
  volume?: number;
  before?: number;
  after?: number;
};

/**
 * Fetch a window of folios anchored on a folio addressed the way it is cited —
 * by number and side, as in `F.157b`.
 *
 * The sibling of {@link getWorkFoliosAround}, which anchors on a folio UUID a
 * caller can only have from a previous read. Without this, locating a cited
 * folio means paging through the work and filtering client-side, or estimating an
 * offset from the work's average folios-per-page — a guess standing in for a
 * predicate. Returns `null` when no such folio exists in the work, which is a
 * different answer from an empty window and worth keeping distinct.
 */
export const getWorkFoliosAt = async ({
  client,
  uuid,
  toh,
  folioNumber,
  side,
  volume,
  before = 0,
  after = 0,
}: GetWorkFoliosAtArgs): Promise<FoliosAround | null> => {
  let query = client
    .from('tibetan_works_folios')
    .select(FOLIO_POSITION_COLUMNS)
    .eq('work_uuid', uuid)
    .eq('toh', toh)
    .eq('folio_number', folioNumber)
    .eq('side', side);

  if (volume !== undefined) {
    query = query.eq('volume_number', volume);
  }

  const { data, error } = await query
    .order('volume_number', { ascending: true })
    .limit(1);

  if (error) {
    console.error('Error resolving folio by number:', error);
    return null;
  }

  const position = data?.[0] as FolioPosition | undefined;
  if (!position) {
    return null;
  }

  return getWorkFoliosAroundPosition({
    client,
    uuid,
    toh,
    position,
    before,
    after,
  });
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
