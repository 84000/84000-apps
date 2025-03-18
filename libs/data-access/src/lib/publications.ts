import { DataClient, TranslationDTO, translationFromDTO } from './types';

export const getTranslationUuids = async ({
  client,
}: {
  client: DataClient;
}) => {
  const { data } = await client.from('translation_json').select('uuid');
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
    .eq('uuid', uuid)
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
