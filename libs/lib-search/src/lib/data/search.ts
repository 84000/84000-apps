'use server';

import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { searchResultsFromDTO } from '../types';

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
