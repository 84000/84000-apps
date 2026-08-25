import {
  BodyItemType,
  DataClient,
  Title,
  TitleDTO,
  WorkDTO,
  titlesFromDTO,
  workFromDTO,
  passagesPageFromDTO,
  PassagesPageDTO,
  PassagesPage,
  PaginationDirection,
  passagesPageAroundFromDTO,
  PassagesPageAroundDTO,
  Work,
  TohokuCatalogEntry,
  normalizeToh,
  tohNoteMentions,
} from './types';

type WorksPageInfo = {
  nextCursor: string | null;
  prevCursor: string | null;
  hasMoreAfter: boolean;
  hasMoreBefore: boolean;
};

export type WorksPage = {
  items: Work[];
  pageInfo: WorksPageInfo;
  totalCount: number;
};

export const getTranslationUuids = async ({
  client,
}: {
  client: DataClient;
}): Promise<string[]> => {
  const { data } = await client.rpc('get_static_translation_uuids');
  return data?.map(({ uuid }: { uuid: string }) => uuid) || [];
};

export const getWorkUuidByToh = async ({
  client,
  toh,
}: {
  client: DataClient;
  toh: string;
}): Promise<string | null> => {
  const { data, error } = await client
    .from('work_toh')
    .select('work_uuid')
    .eq('toh_clean', toh)
    .single();

  if (error || !data) {
    if (error) {
      console.error('Error fetching work UUID by TOH:', error);
    }
    return null;
  }

  return data.work_uuid ?? null;
};

export const getWorkUuidByXmlid = async ({
  client,
  xmlid,
}: {
  client: DataClient;
  xmlid: string;
}): Promise<string | null> => {
  const { data, error } = await client
    .from('works')
    .select('uuid')
    .eq('xmlId', xmlid)
    .single();

  if (error || !data) {
    if (error) {
      console.error('Error fetching work UUID by XMLID:', error);
    }
    return null;
  }

  return data.uuid ?? null;
};

export const getTranslationPassages = async ({
  client,
  uuid,
  type,
  cursor,
  maxPassages,
  maxCharacters,
  direction,
}: {
  client: DataClient;
  uuid: string;
  type?: BodyItemType;
  cursor?: string;
  maxPassages?: number;
  maxCharacters?: number;
  direction?: PaginationDirection;
}): Promise<PassagesPage> => {
  const { data, error } = await client.rpc('get_passages_page', {
    uuid_input: uuid,
    passage_type_input: type,
    cursor,
    max_passages: maxPassages,
    char_budget: maxCharacters,
    direction,
  });

  if (error) {
    console.error('Error fetching translation passages:', error);
    return {
      hasMoreAfter: false,
      hasMoreBefore: false,
      passages: [],
    };
  }

  return passagesPageFromDTO(direction || 'forward', data as PassagesPageDTO);
};

export const getTranslationPassagesAround = async ({
  client,
  uuid,
  passageUuid,
  type,
  maxPassages,
  maxCharacters,
}: {
  client: DataClient;
  uuid: string;
  passageUuid: string;
  type?: BodyItemType;
  maxPassages?: number;
  maxCharacters?: number;
}): Promise<PassagesPage> => {
  const { data, error } = await client.rpc('get_passages_page_around', {
    uuid_input: uuid,
    cursor: passageUuid,
    passage_type_input: type,
    max_passages: maxPassages,
    char_budget: maxCharacters,
  });

  if (error) {
    console.error('Error fetching translation passages around:', error);
    return {
      hasMoreAfter: false,
      hasMoreBefore: false,
      passages: [],
    };
  }

  return passagesPageAroundFromDTO(data as PassagesPageAroundDTO);
};

/**
 * Columns a title is read with. `content` is aliased to `title` because that is
 * what the domain type calls it — the alias is the only thing the old
 * `get_work_titles` RPC was doing that a plain select does not.
 */
const TITLE_COLUMNS = 'uuid, title:content, language, type, attestation';

/**
 * Read every title belonging to a work.
 *
 * Selects the table directly rather than going through the `get_work_titles`
 * RPC. The RPC was a plain select behind an alias, so every column added to
 * `titles` needed a schema migration before the app could see it — which is how
 * `attestation` came to be invisible to the whole read path. Choosing columns
 * here keeps that in application code.
 *
 * The RPC still exists and is intentionally not dropped: apps running an older
 * published `data-access` still call it.
 *
 * Titles are unversioned, so there is no published/draft variant to resolve.
 */
export const getWorkTitles = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}): Promise<Title[]> => {
  const { data, error } = await client
    .from('titles')
    .select<string, TitleDTO>(TITLE_COLUMNS)
    .eq('work_uuid', uuid)
    // The table carries no natural order, and an updated row moves to the end of
    // the heap, so an unordered read would reshuffle after every edit. Order
    // explicitly, down to the UUID, so the sequence is total and stable.
    .order('type', { ascending: true })
    .order('language', { ascending: true })
    .order('uuid', { ascending: true });

  if (error) {
    console.error('Error fetching work titles:', error);
    return [];
  }

  return titlesFromDTO(data ?? []);
};

/** @deprecated Prefer {@link getWorkTitles}, which this now delegates to. */
export const getTranslationTitles = async (args: {
  client: DataClient;
  uuid: string;
}) => getWorkTitles(args);

export const getWorkTitlesByUuids = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids: readonly string[];
}): Promise<Map<string, string>> => {
  const titlesByUuid = new Map<string, string>();
  if (uuids.length === 0) return titlesByUuid;

  const { data, error } = await client
    .from('works')
    .select('uuid, title')
    .in('uuid', uuids as string[]);

  if (error) {
    console.error('Error batch loading work titles:', error);
    return titlesByUuid;
  }

  for (const work of data ?? []) {
    if (work.title) {
      titlesByUuid.set(work.uuid, work.title);
    }
  }

  return titlesByUuid;
};

/** A work reduced to what it takes to cite it: identity, title, catalogue numbers. */
export type WorkRef = {
  uuid: string;
  title: string;
  toh: TohokuCatalogEntry[];
};

/**
 * Batch-fetch citable work identity by UUID.
 *
 * Cross-work reads — glossary terms gathered across a canonical section, say —
 * come back keyed by work UUID, which is not something a reader can cite. This
 * resolves a whole result set's works in one round trip rather than per row.
 */
export const getWorkRefsByUuids = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids: readonly string[];
}): Promise<Map<string, WorkRef>> => {
  const refsByUuid = new Map<string, WorkRef>();
  if (uuids.length === 0) {
    return refsByUuid;
  }

  const { data, error } = await client
    .from('works')
    .select('uuid, title, tohs:work_toh(toh:toh_clean)')
    .in('uuid', uuids as string[]);

  if (error) {
    console.error('Error batch loading work refs:', error);
    return refsByUuid;
  }

  for (const row of data ?? []) {
    const tohs = (row.tohs ?? []) as { toh: TohokuCatalogEntry }[];
    refsByUuid.set(row.uuid as string, {
      uuid: row.uuid as string,
      title: (row.title as string) || '<Untitled>',
      toh: tohs.map((entry) => entry.toh),
    });
  }

  return refsByUuid;
};

/**
 * A Tohoku number resolved to the work and catalogue entry it actually names.
 */
export type TohResolution = {
  /** The number as normalized from the caller's input. */
  requested: TohokuCatalogEntry;
  workUuid: string;
  /**
   * The number this work's folios and passages are stored under — the one to
   * pass to subsequent reads. Differs from `requested` for an alias.
   */
  toh: TohokuCatalogEntry;
  /** True when `requested` was found in a note rather than as a catalogue entry. */
  alias: boolean;
  /** The note that recorded the alias, when one applies. */
  note?: string;
  /**
   * Every number this work is catalogued under, `toh` included. More than one
   * means the work sits at several distinct points in the canon, each with its
   * own folios — not that the extras are aliases.
   */
  placements: TohokuCatalogEntry[];
};

/**
 * Resolve a Tohoku number, following aliases.
 *
 * A number a translator cites is not always a catalogue entry: some works are
 * cited under a superseded number recorded only in `work_toh.toh_note` (Toh 418
 * is catalogued as Toh 417). Folio and passage reads key on the catalogued
 * number, so they return "not found" for an alias — indistinguishable, to the
 * caller, from a number that does not exist. Resolving first tells the two apart.
 *
 * Returns every candidate rather than one: an exact catalogue hit yields a single
 * resolution, but a note can name the same number for more than one work, and
 * choosing between those is the caller's to report, not this function's to guess.
 * An empty array means the number resolves to nothing at all.
 */
export const resolveToh = async ({
  client,
  toh,
}: {
  client: DataClient;
  toh: string;
}): Promise<TohResolution[]> => {
  const requested = normalizeToh(toh);
  if (!requested) {
    return [];
  }

  const { data: exact, error: exactError } = await client
    .from('work_toh')
    .select('work_uuid, toh_clean, toh_note')
    .eq('toh_clean', requested);

  if (exactError) {
    console.error('Error resolving toh:', exactError);
    return [];
  }

  const digits = requested.replace(/^toh/, '');
  const rows = exact ?? [];
  let alias = false;

  // Only fall back to the notes when the number is not itself catalogued —
  // an exact entry is never an alias, and a note elsewhere mentioning the same
  // digits would otherwise add spurious candidates.
  if (rows.length === 0) {
    const { data: noted, error: notedError } = await client
      .from('work_toh')
      .select('work_uuid, toh_clean, toh_note')
      .ilike('toh_note', `%${digits}%`);

    if (notedError) {
      console.error('Error resolving toh note:', notedError);
      return [];
    }

    // The ILIKE is a coarse prefilter; `1418` and `4180` both match `%418%`.
    rows.push(
      ...(noted ?? []).filter((row) =>
        tohNoteMentions(row.toh_note as string | null, requested),
      ),
    );
    alias = rows.length > 0;
  }

  if (rows.length === 0) {
    return [];
  }

  const workUuids = [...new Set(rows.map((row) => row.work_uuid as string))];
  const { data: placements, error: placementsError } = await client
    .from('work_toh')
    .select('work_uuid, toh_clean')
    .in('work_uuid', workUuids);

  if (placementsError) {
    console.error('Error fetching toh placements:', placementsError);
  }

  const byWork = new Map<string, TohokuCatalogEntry[]>();
  for (const row of placements ?? []) {
    const list = byWork.get(row.work_uuid as string) ?? [];
    list.push(row.toh_clean as TohokuCatalogEntry);
    byWork.set(row.work_uuid as string, list);
  }

  return rows.map((row) => ({
    requested,
    workUuid: row.work_uuid as string,
    toh: row.toh_clean as TohokuCatalogEntry,
    alias,
    note: alias ? ((row.toh_note as string | null) ?? undefined) : undefined,
    placements: (
      byWork.get(row.work_uuid as string) ?? [
        row.toh_clean as TohokuCatalogEntry,
      ]
    ).sort(),
  }));
};

export const getTranslationMetadataByUuid = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client
    .from('works')
    .select(
      `
      uuid,
      title,
      description,
      tohs:work_toh!inner(toh:toh_clean),
      publicationDate,
      publicationVersion,
      pages:source_pages,
      restriction,
      breadcrumb,
      published_version_uuid,
      publicationStatus
    `,
    )
    .eq('uuid', uuid)
    .single();

  if (error) {
    throw new Error(
      `Error fetching translation metadata by UUID: ${error.message}`,
    );
  }

  return workFromDTO(data as WorkDTO);
};

export const getTranslationMetadataByToh = async ({
  client,
  toh,
}: {
  client: DataClient;
  toh: string;
}) => {
  const { data, error } = await client
    .from('work_toh')
    .select(
      `
      work_uuid,
      works!inner(
        uuid,
        title,
        description,
        tohs:work_toh!inner(toh:toh_clean),
        publicationDate,
        publicationVersion,
        pages:source_pages,
        restriction,
        breadcrumb
      )
    `,
    )
    .eq('toh_clean', toh)
    .single();

  // Extract the work data from the joined result
  const workData = data?.works as WorkDTO | undefined;
  if (error || !workData) {
    console.error('Error fetching translation metadata by TOH:', error);
    return null;
  }

  return workFromDTO(workData);
};

export const getTranslationsMetadata = async ({
  client,
}: {
  client: DataClient;
}): Promise<Work[]> => {
  const { data, error } = await client
    .from('works')
    .select(
      `
      uuid,
      title,
      description,
      tohs:work_toh!inner(toh:toh_clean),
      publicationDate,
      publicationVersion,
      pages:source_pages,
      restriction,
      breadcrumb,
      published_version_uuid,
      publicationStatus
    `,
    )
    .not('toh', 'like', 'toh00%');
  if (error) {
    console.error('Error fetching translations metadata:', error);
    return [];
  }

  const dto = data as WorkDTO[];
  return dto?.map((work) => workFromDTO(work as WorkDTO)) || [];
};

export const getWorksPage = async ({
  client,
  cursor,
  limit = 50,
  maxPages,
}: {
  client: DataClient;
  cursor?: string;
  limit?: number;
  maxPages?: number;
}): Promise<WorksPage> => {
  const clampedLimit = Math.min(limit, 200);

  let query = client
    .from('works')
    .select(
      `
      uuid,
      title,
      description,
      tohs:work_toh!inner(toh:toh_clean),
      publicationDate,
      publicationVersion,
      pages:source_pages,
      restriction,
      breadcrumb,
      published_version_uuid,
      publicationStatus
    `,
      { count: 'exact' },
    )
    .not('toh', 'like', 'toh00%')
    .order('title', { ascending: true })
    .limit(clampedLimit + 1);

  if (maxPages) {
    query = query.lt('source_pages', maxPages);
  }

  if (cursor) {
    const { data: cursorWork } = await client
      .from('works')
      .select('title')
      .eq('uuid', cursor)
      .single();

    if (cursorWork) {
      query = query.gt('title', cursorWork.title);
    }
  }

  const { data, error, count } = await query;

  if (error) {
    console.error('Error fetching works:', error);
    return {
      items: [],
      pageInfo: {
        nextCursor: null,
        prevCursor: null,
        hasMoreAfter: false,
        hasMoreBefore: false,
      },
      totalCount: 0,
    };
  }

  const hasMoreAfter = (data ?? []).length > clampedLimit;
  const items = hasMoreAfter
    ? (data ?? []).slice(0, clampedLimit)
    : (data ?? []);
  const works = items.map((dto) => workFromDTO(dto as WorkDTO));

  return {
    items: works,
    pageInfo: {
      nextCursor: hasMoreAfter ? (works[works.length - 1]?.uuid ?? null) : null,
      prevCursor: cursor ?? null,
      hasMoreAfter,
      hasMoreBefore: Boolean(cursor),
    },
    totalCount: count ?? 0,
  };
};

/**
 * The live version label for each of `versionUuids`.
 *
 * The label lives on `work_versions`, one join away from the pointer a work carries, so a
 * list query would otherwise make a round trip per work. Batched for the GraphQL loader.
 *
 * Absent from the map means the pointer names a row that is not there. That should not
 * happen — the pointer is a foreign key — but the caller distinguishes it from "never
 * published", which is a null pointer and never reaches here.
 */
export const getVersionLabelsByUuids = async ({
  client,
  versionUuids,
}: {
  client: DataClient;
  versionUuids: readonly string[];
}): Promise<Map<string, string>> => {
  const labelsByUuid = new Map<string, string>();
  if (versionUuids.length === 0) return labelsByUuid;

  const { data, error } = await client
    .from('work_versions')
    .select('uuid, version')
    .in('uuid', versionUuids as string[]);

  if (error) {
    console.error('Error batch loading version labels:', error);
    return labelsByUuid;
  }

  for (const row of data ?? []) {
    if (row.version) labelsByUuid.set(row.uuid, row.version);
  }

  return labelsByUuid;
};
