import {
  BibliographyEntriesDTO,
  bibliographyEntriesFromDTO,
  DataClient,
} from './types';

export const getBibliographyEntries = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc('show_bibliographies', {
    v_work_uuid: uuid,
  });
  if (error) {
    console.error(
      `Error fetching glossary instances for work: ${uuid} `,
      error,
    );
    return [];
  }

  const dto = data as BibliographyEntriesDTO;
  return bibliographyEntriesFromDTO(dto);
};
