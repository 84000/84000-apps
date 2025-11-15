import {
  BodyItemType,
  DataClient,
  TitlesDTO,
  WorkDTO,
  titlesFromDTO,
  workFromDTO,
  passagesPageFromDTO,
  PassagesPageDTO,
  PassagesPage,
} from './types';

export const getTranslationUuids = async ({
  client,
}: {
  client: DataClient;
}): Promise<string[]> => {
  const { data } = await client.rpc('get_static_translation_uuids');
  return data?.map(({ uuid }: { uuid: string }) => uuid) || [];
};

export const getTranslationPassages = async ({
  client,
  uuid,
  type,
  cursor,
  maxPassages,
  maxCharacters,
}: {
  client: DataClient;
  uuid: string;
  type?: BodyItemType;
  cursor?: string;
  maxPassages?: number;
  maxCharacters?: number;
}): Promise<PassagesPage> => {
  const { data, error } = await client.rpc('get_passages_page', {
    uuid_input: uuid,
    passage_type_input: type,
    cursor,
    max_passages: maxPassages,
    char_budget: maxCharacters,
  });

  if (error) {
    console.error('Error fetching translation passages:', error);
    return {
      hasMore: false,
      passages: [],
    };
  }

  return passagesPageFromDTO(data as PassagesPageDTO);
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

export const getTranslationMetadataByUuid = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data } = await client
    .from('works')
    .select(
      `
      uuid,
      title,
      toh,
      publicationDate,
      publicationVersion,
      pages:source_pages,
      restriction,
      breadcrumb
    `,
    )
    .eq('uuid', uuid)
    .single();

  return workFromDTO(data as WorkDTO);
};

export const getTranslationMetadataByToh = async ({
  client,
  toh,
}: {
  client: DataClient;
  toh: string;
}) => {
  const { data } = await client
    .from('works')
    .select(
      `
      uuid,
      title,
      toh,
      publicationDate,
      publicationVersion,
      pages:source_pages,
      restriction,
      breadcrumb
    `,
    )
    .eq('toh', toh)
    .single();

  return workFromDTO(data as WorkDTO);
};

export const getTranslationsMetadata = async ({
  client,
}: {
  client: DataClient;
}) => {
  // NOTE: currently we only fetch works "published" to translation_json, but
  // that may not be the right choice in the future.
  const { data } = await client.from('translation_json').select(
    `
    work:works!work_uuid (
      uuid,
      title,
      toh,
      publicationDate,
      publicationVersion,
      pages:source_pages,
      restriction,
      breadcrumb
    )
  `,
  );

  return (
    data?.map(({ work }: { work: unknown }) => workFromDTO(work as WorkDTO)) ||
    []
  );
};
