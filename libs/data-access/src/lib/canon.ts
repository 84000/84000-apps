import { CanonDTO, DataClient, canonTreeFromDTOs } from './types';

export const getCanonTree = async ({ client }: { client: DataClient }) => {
  const { data, error } = await client.from('catalogs').select();

  if (error) {
    console.error('Error fetching canon tree:', error);
    return null;
  }

  return canonTreeFromDTOs(data as CanonDTO[]);
};
