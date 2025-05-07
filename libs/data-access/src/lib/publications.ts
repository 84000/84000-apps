import {
  BodyItemType,
  DataClient,
  TitlesDTO,
  TranslationDTO,
  titlesFromDTO,
  translationBodyFromDTO,
  translationFromDTO,
} from './types';
import { WorkDTO, workFromDTO } from './types/work';

export const getTranslationUuids = async ({
  client,
}: {
  client: DataClient;
}) => {
  const { data } = await client
    .from('translation_json')
    .select('uuid:work_uuid');
  return data?.map(({ uuid }) => uuid) || [];
};

export const getTranslationByUuid = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data } = await client
    .from('translation_json')
    .select('translation')
    .eq('work_uuid', uuid)
    .single();

  if (!data?.translation) {
    return null;
  }

  return translationFromDTO(data.translation as TranslationDTO);
};

export const getTranslationPassages = async ({
  client,
  uuid,
  type,
}: {
  client: DataClient;
  uuid: string;
  type: BodyItemType;
}) => {
  const { data } = await client.rpc('get_passages_with_annotations', {
    uuid_input: uuid,
    passage_type_input: type,
  });

  return translationBodyFromDTO(data || []);
};

export const getTranslationAcknowledgements = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  return getTranslationPassages({ client, uuid, type: 'acknowledgment' });
};

export const getTranslationBody = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  return getTranslationPassages({ client, uuid, type: 'translation' });
};

export const getTranslationEndnotes = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  return getTranslationPassages({ client, uuid, type: 'end-note' });
};

export const getTranslationIntroduction = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  return getTranslationPassages({ client, uuid, type: 'introduction' });
};

export const getTranslationSummary = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  return getTranslationPassages({ client, uuid, type: 'summary' });
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

  console.log(data);

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
      restriction
    `,
    )
    .eq('uuid', uuid)
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
      restriction
    )
  `,
  );

  return (
    data?.map(({ work }: { work: unknown }) => workFromDTO(work as WorkDTO)) ||
    []
  );
};
