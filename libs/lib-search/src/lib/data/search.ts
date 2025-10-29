'use server';

import { createServerClient } from '@data-access/ssr';
import { searchResultsFromDTO } from '../types';

export const search = async ({
  text,
  uuid,
  toh,
}: {
  text: string;
  uuid: string;
  toh: string;
}) => {
  const client = await createServerClient();
  const { data, error } = await client.rpc('translation_search', {
    search_term: text,
    work_uuid: uuid,
    toh: toh,
  });

  if (error) {
    console.error('Search error:', error);
    return;
  }

  return searchResultsFromDTO(data);
};
