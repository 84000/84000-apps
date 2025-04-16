import {
  DataClient,
  TranslationDTO,
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

export const getTranslationBody = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data } = await client
    .from('passages')
    .select(
      `
      uuid,
      content,
      xmlId,
      work_uuid,
      label,
      sort,
      parent,
      type,
      annotations:passage_annotations!passage_uuid (
        uuid,
        content,
        type,
        start,
        end,
        passage_uuid
      )
    `,
    )
    .eq('work_uuid', uuid)
    .like('type', 'translation%')
    .order('sort');

  return translationBodyFromDTO(data || []);
};

export const getTranslationSlugs = async ({
  client,
}: {
  client: DataClient;
}) => {
  const { data } = await client.from('translation_json').select('toh');
  return data?.map(({ toh }: { toh: string }) => toh) || [];
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
