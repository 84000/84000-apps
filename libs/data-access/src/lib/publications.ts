import { getBibliographyEntries } from './bibliography';
import { getGlossaryInstances } from './glossary';
import {
  BodyItemType,
  DataClient,
  TitlesDTO,
  WorkDTO,
  titlesFromDTO,
  passagesFromDTO,
  workFromDTO,
  Translation,
  Passages,
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
}: {
  client: DataClient;
  uuid: string;
  type?: BodyItemType;
}) => {
  const { data, error } = await client.rpc('get_passages_with_annotations', {
    uuid_input: uuid,
    passage_type_input: type,
  });

  if (error) {
    console.error('Error fetching translation passages:', error);
    return [];
  }

  return passagesFromDTO(data || []);
};

export const getTranslationPassageTypes = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc(
    'scholar_passages_get_types_by_work',
    {
      work_uuid_param: uuid,
    },
  );

  if (error) {
    console.error('Error fetching passage types:', error);
    return [];
  }

  return data as BodyItemType[];
};

export const getTranslationSlugs = async ({
  client,
}: {
  client: DataClient;
}) => {
  const { data } = await client.from('translation_json').select('toh');
  return data?.map(({ toh }: { toh: string }) => toh) || [];
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

export const getTranslationByUuid = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}): Promise<Translation> => {
  const metadata = await getTranslationMetadataByUuid({ client, uuid });
  const titles = await getTranslationTitles({ client, uuid });
  const glossary = await getGlossaryInstances({ client, uuid });
  const bibliography = await getBibliographyEntries({ client, uuid });
  const passages = await getTranslationPassages({ client, uuid });

  const passagesByType: Partial<Record<BodyItemType, Passages>> =
    passages.reduce(
      (acc, passage) => {
        const type = passage.type.replace('Header', '') as BodyItemType;

        if (!acc[type]) {
          acc[type] = [];
        }

        acc[type]?.push(passage);
        return acc;
      },
      {} as Partial<Record<BodyItemType, Passages>>,
    );

  return {
    metadata,
    titles,
    passages: passagesByType,
    glossary,
    bibliography,
  };
};
