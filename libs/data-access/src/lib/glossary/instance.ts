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

const GLOSSARY_INDEX_COLUMNS =
  'glossary_uuid, authority_uuid, work_uuid, definition, english, wylie, tibetan, sanskrit_plain, chinese, pali, alternatives';

type GlossaryTermIndexInstanceRow = {
  glossary_uuid: string;
  authority_uuid: string;
  work_uuid: string;
  definition: string | null;
  english: string | null;
  wylie: string | null;
  tibetan: string | null;
  sanskrit_plain: string | null;
  chinese: string | null;
  pali: string | null;
  alternatives: string | null;
};

const indexRowToDTO = (
  row: GlossaryTermIndexInstanceRow,
): GlossaryTermInstanceDTO => ({
  uuid: row.glossary_uuid,
  authority_uuid: row.authority_uuid,
  work_uuid: row.work_uuid,
  definition: row.definition ?? undefined,
  names: {
    english: row.english ?? undefined,
    tibetan: row.tibetan ?? undefined,
    sanskrit: row.sanskrit_plain ?? undefined,
    pali: row.pali ?? undefined,
    chinese: row.chinese ?? undefined,
    wylie: row.wylie ?? undefined,
    alternatives: row.alternatives ?? undefined,
  },
});

const fetchIndexRow = async (client: DataClient, uuid: string) => {
  const { data, error } = await client
    .from('glossary_term_index')
    .select(GLOSSARY_INDEX_COLUMNS)
    .eq('glossary_uuid', uuid)
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(`Error fetching glossary instance: ${uuid} `, error);
    return null;
  }
  return data as GlossaryTermIndexInstanceRow | null;
};

export const getGlossaryInstance = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  // 1) Direct lookup in the glossary_term_index view.
  let row = await fetchIndexRow(client, uuid);

  // 2) Fallback: the uuid may be a non-translationMain child that isn't
  //    represented in the index. Resolve its parent via glossary_edges and
  //    retry the index lookup with the parent uuid.
  if (!row) {
    const { data: edge, error: edgeError } = await client
      .from('glossary_edges')
      .select('parent_uuid')
      .eq('child_uuid', uuid)
      .limit(1)
      .maybeSingle();
    if (edgeError) {
      console.error(`Error fetching glossary edge: ${uuid} `, edgeError);
    } else if (edge?.parent_uuid) {
      row = await fetchIndexRow(client, edge.parent_uuid);
    }
  }

  if (!row) {
    return undefined;
  }

  return glossaryTermInstanceFromDTO(indexRowToDTO(row));
};
