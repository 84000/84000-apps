import {
  DataClient,
  GlossaryDetailDTO,
  GlossaryEntityDTO,
  GlossaryInstanceDTO,
  GlossaryTermInstanceDTO,
  GlossaryLandingItem,
  GlossaryLandingItemDTO,
  glossaryTermInstanceFromDTO,
  glossaryLandingItemFromDTO,
  glossaryPageItemFromDTO,
  GlossaryTermInstancesDTO,
} from './types';

export const getAllGlossaryTerms = async ({
  client,
  uuids,
}: {
  client: DataClient;
  uuids?: string[];
}): Promise<GlossaryLandingItem[]> => {
  const pageSize = 1000;
  let start = 0;
  let end = pageSize - 1;
  let count = pageSize;
  const terms: GlossaryLandingItem[] = [];

  while (count === pageSize) {
    let rpc = client.rpc('scholar_glossary_get_all');

    if (uuids?.length) {
      rpc = rpc.in('authority_uuid', uuids);
    }

    const { data, error } = await rpc.range(start, end);

    if (error) {
      console.error('Error fetching glossary terms:', error);
      return [];
    }
    if (!data || !data.length) {
      break;
    }

    const dtos = data as GlossaryLandingItemDTO[];
    const items = dtos
      .map((item) => glossaryLandingItemFromDTO(item as GlossaryLandingItemDTO))
      .flatMap((item) => (item ? [item] : []));

    terms.push(...items);
    start += pageSize;
    end += pageSize;
    count = data.length;
  }

  return terms;
};

export const getGlossaryInstances = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data, error } = await client.rpc('show_glossary_entries', {
    v_work_uuid: uuid,
  });
  if (error) {
    console.error(
      `Error fetching glossary instances for work: ${uuid} `,
      error,
    );
    return [];
  }

  const dto = data as GlossaryTermInstancesDTO;
  return dto.glossary_entries.map(glossaryTermInstanceFromDTO);
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

export const getGlossaryEntry = async ({
  client,
  uuid,
}: {
  client: DataClient;
  uuid: string;
}) => {
  const { data: details = [], error: detailError } = await client.rpc(
    'scholar_glossary_detail',
    { v_uuid: uuid },
  );

  if (detailError || !details?.length) {
    console.error('Error fetching glossary item:', detailError);
    return null;
  }

  const detail = details[0];

  const { data: entities = [], error: entitiesError } = await client.rpc(
    'scholar_glossary_detail_related_entities',
    { v_uuid: uuid },
  );
  if (entitiesError) {
    console.error('Error fetching related entities:', entitiesError);
  }

  const { data: glossaries = [], error: glossariesError } = await client.rpc(
    'scholar_glossary_detail_related_glossaries',
    { v_uuid: uuid },
  );
  if (glossariesError) {
    console.error('Error fetching related glossaries:', glossariesError);
  }

  return glossaryPageItemFromDTO(
    detail as GlossaryDetailDTO,
    glossaries as GlossaryInstanceDTO[],
    entities as GlossaryEntityDTO[],
  );
};
