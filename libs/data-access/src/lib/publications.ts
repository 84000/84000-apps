import { DataClient, TranslationDTO, translationFromDTO } from './types';
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

export const getTranslationSlugs = async ({
  client,
}: {
  client: DataClient;
}) => {
  const { data } = await client.from('translation_json').select('toh');
  return data?.map(({ toh }: { toh: string }) => toh) || [];
};

export const getTranslationBySlug = async ({
  client,
  slug,
}: {
  client: DataClient;
  slug: string;
}) => {
  const { data } = await client
    .from('translation_json')
    .select('translation')
    .eq('toh', slug)
    .single();

  if (!data?.translation) {
    return null;
  }

  return translationFromDTO(data.translation as TranslationDTO);
};

export const getTranslationsMetadata = async ({
  client,
}: {
  client: DataClient;
}) => {
  // NOTE: currently we only fetch works "published" to translation_json, but
  // that may not be the right choice in the future.
  const { data } = await client.from('translation_json').select(`
    work:works!work_uuid (
      uuid,
      title,
      toh,
      publicationDate,
      publicationVersion,
      pages:source_pages,
      restriction
    )
  `);

  return (
    data?.map(({ work }: { work: unknown }) => workFromDTO(work as WorkDTO)) ||
    []
  );
};
