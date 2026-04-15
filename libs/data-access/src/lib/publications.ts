import {
  BodyItemType,
  DataClient,
  Title,
  TitlesDTO,
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

export const getTranslationTitles = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data } = await client.rpc('get_work_titles', {
    work_uuid_input: uuid,
  });

  return titlesFromDTO(data as TitlesDTO);
};

export const getWorkTitles = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}): Promise<Title[]> => {
  const { data, error } = await client.rpc('get_work_titles', {
    work_uuid_input: uuid,
  });

  if (error) {
    console.error('Error fetching work titles:', error);
    return [];
  }

  return titlesFromDTO(data as TitlesDTO);
};

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
      breadcrumb
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
      breadcrumb
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
      breadcrumb
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
