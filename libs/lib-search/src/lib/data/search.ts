'use server';

import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { searchResultsFromDTO } from '../types';
import {
  DEFAULT_CONTENT_SOURCE,
  contentSourceFromEnv,
  rpcFor,
  type ContentSource,
  type DataClient,
} from '@eightyfourthousand/data-access';

export const search = async ({
  text,
  uuid,
  toh,
  useRegex = false,
  // Follows the app this action runs in, so public search tracks whatever that
  // app serves rather than needing its own decision.
  source = contentSourceFromEnv(),
}: {
  text: string;
  uuid: string;
  toh: string;
  useRegex?: boolean;
  source?: ContentSource;
}) => {
  const client = await createServerClient();
  return await searchWithClient({ client, text, uuid, toh, useRegex, source });
};

export const searchWithClient = async ({
  client,
  text,
  uuid,
  toh,
  useRegex = false,
  // Not env-derived: lib-agent calls this for the public MCP API, which reads
  // draft throughout until that path is switched. Leaving it ambient here would
  // make MCP search published while the rest of MCP stayed draft.
  source = DEFAULT_CONTENT_SOURCE,
}: {
  client: DataClient;
  text: string;
  uuid: string;
  toh: string;
  useRegex?: boolean;
  source?: ContentSource;
}) => {
  const { data, error } = await client.rpc(rpcFor('translationSearch', source), {
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
