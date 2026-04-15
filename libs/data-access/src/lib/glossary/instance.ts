import {
  DataClient,
  GlossaryTermInstanceDTO,
  GlossaryTermInstancesDTO,
  glossaryTermInstanceFromDTO,
} from '../types';

export const getGlossaryInstances = async ({
  client,
  uuid,
  withAttestations = false,
}: {
  client: DataClient;
  uuid: string;
  withAttestations?: boolean;
}) => {
  const { data, error } = await client.rpc('show_glossary_entries', {
    v_work_uuid: uuid,
    v_with_attestation: withAttestations,
  });
  if (error) {
    console.error(
      `Error fetching glossary instances for work: ${uuid} `,
      error,
    );
    return [];
  }

  const dto = data as GlossaryTermInstancesDTO;
  return dto.glossary_entries.map(glossaryTermInstanceFromDTO).sort((a, b) => {
    const nameA = a.names.english || '';
    const nameB = b.names.english || '';
    return nameA.localeCompare(nameB);
  });
};

export const getGlossaryInstance = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc('show_glossary_entry', {
    v_glossary_uuid: uuid,
  });

  if (error) {
    console.error(`Error fetching glossary instance: ${uuid} `, error);
    return undefined;
  }

  return glossaryTermInstanceFromDTO(data as GlossaryTermInstanceDTO);
};
