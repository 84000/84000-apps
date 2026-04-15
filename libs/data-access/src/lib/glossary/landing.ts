import {
  DataClient,
  GlossaryLandingItem,
  GlossaryLandingItemDTO,
  glossaryLandingItemFromDTO,
} from '../types';

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
