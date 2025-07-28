import { DataClient } from './types';
import {
  GlossaryDetailDTO,
  GlossaryEntityDTO,
  GlossaryInstanceDTO,
  GlossaryLandingItem,
  GlossaryLandingItemDTO,
  glossaryLandingItemFromDTO,
  glossaryPageItemFromDTO,
} from './types/glossary-page';

export const getAllGlossaryTerms = async ({
  client,
}: {
  client: DataClient;
}): Promise<GlossaryLandingItem[]> => {
  const pageSize = 1000;
  let start = 0;
  let end = pageSize - 1;
  let count = pageSize;
  const terms: GlossaryLandingItem[] = [];

  while (count === pageSize) {
    const { data, error } = await client
      .rpc('scholar_glossary_get_all')
      .range(start, end);

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
