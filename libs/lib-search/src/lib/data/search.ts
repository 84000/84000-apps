'use server';

import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { searchResultsFromDTO } from '../types';
import { DataClient } from '@eightyfourthousand/data-access';

export const search = async ({
  text,
  uuid,
  toh,
  useRegex = false,
}: {
  text: string;
  uuid: string;
  toh: string;
  useRegex?: boolean;
}) => {
  const client = await createServerClient();
  return await searchWithClient({ client, text, uuid, toh, useRegex });
};

export const searchWithClient = async ({
  client,
  text,
  uuid,
  toh,
  useRegex = false,
}: {
  client: DataClient;
  text: string;
  uuid: string;
  toh: string;
  useRegex?: boolean;
}) => {
  const { data, error } = await client.rpc('translation_search', {
    search_term: text,
    work_uuid: uuid,
    toh: toh,
    use_regex: useRegex,
  });

  if (error) {
    console.error('Search error:', error);
    return;
  }

  return searchResultsFromDTO(data);
};
