import { DataClient, imprintFromDTO, tocFromDTO } from './types';

export const getTranslationToc = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc('get_work_toc', {
    work_uuid_input: uuid,
  });

  if (error) {
    console.error('Error fetching TOC:', error);
    return undefined;
  }

  return tocFromDTO(data || []);
};

export const getTranslationImprint = async ({
  client,
  uuid,
  toh,
}: {
  client: DataClient;
  uuid: string;
  toh: string;
}) => {
  const { data, error } = await client.rpc('get_imprint', {
    work_uuid: uuid,
    toh,
  });

  if (error || !data) {
    console.error('Error fetching imprint:', error);
    return undefined;
  }

  return imprintFromDTO(data);
};
