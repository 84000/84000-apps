import {
  BibliographyEntriesDTO,
  bibliographyEntriesFromDTO,
  BibliographyEntryItemDTO,
  bibliographyEntryItemFromDTO,
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

export const getBibliographyEntry = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client
    .from('bibliography')
    .select(
      `
      uuid::uuid,
      work_uuid::uuid,
      bibl_html::text
`,
    )
    .eq('uuid', uuid)
    .single();
  if (error) {
    console.error(`Error fetching bibliography entry: ${uuid} `, error);
    return null;
  }

  const dto = data as BibliographyEntryItemDTO;

  return bibliographyEntryItemFromDTO(dto);
};
