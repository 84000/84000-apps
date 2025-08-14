import {
  CanonDTO,
  CanonDetailDTO,
  CanonWorksDTO,
  DataClient,
  canonDetailFromDTO,
  canonTreeFromDTOs,
  caononWorksFromDTO,
} from './types';

export const getCanonTree = async ({ client }: { client: DataClient }) => {
  const { data, error } = await client.rpc('scholar_canon_get_all');

  if (error) {
    console.error('Error fetching canon tree:', error);
    return null;
  }

  return canonTreeFromDTOs(data as CanonDTO[]);
};

export const getCanonSection = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc('scholar_canon_get_detail', {
    uuid_input: uuid,
  });

  if (error) {
    console.error('Error fetching canon section:', error);
    return null;
  }

  return canonDetailFromDTO(data[0] as CanonDetailDTO);
};

export const getCanonWorks = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client
    .rpc('scholar_canon_get_works', {
      uuid_input: uuid,
    })
    .single();

  if (error) {
    console.error('Error fetching canon works:', error);
    return null;
  }

  return caononWorksFromDTO(data as CanonWorksDTO);
};
