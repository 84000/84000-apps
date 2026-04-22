import { DataClient } from '../types';
import {
  GlossaryTermIndexRow,
  GlossaryTermNode,
  rowToGlossaryTermNode,
} from './pagination';

const DEFAULT_SEARCH_LIMIT = 20;
const MAX_SEARCH_LIMIT = 50;

const SEARCH_COLUMNS = `glossary_uuid,
   authority_uuid,
   term_number,
   definition,
   english,
   wylie,
   tibetan,
   sanskrit_plain,
   sanskrit_attested,
   chinese,
   pali,
   alternatives`;

const escapeIlike = (input: string) =>
  input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');

export const searchWorkGlossaryTerms = async ({
  client,
  workUuid,
  query,
  limit = DEFAULT_SEARCH_LIMIT,
  withAttestations = false,
}: {
  client: DataClient;
  workUuid: string;
  query: string;
  limit?: number;
  withAttestations?: boolean;
}): Promise<GlossaryTermNode[]> => {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }

  const clampedLimit = Math.min(Math.max(limit, 1), MAX_SEARCH_LIMIT);
  const pattern = `${escapeIlike(trimmed)}%`;

  const { data, error } = await client
    .from('glossary_term_index')
    .select(SEARCH_COLUMNS)
    .eq('work_uuid', workUuid)
    .or(`english.ilike.${pattern},alternatives.ilike.${pattern}`)
    .order('term_number', { ascending: true })
    .limit(clampedLimit);

  if (error) {
    console.error(`Failed to search glossary terms: ${error.message}`);
    return [];
  }

  const rows = (data ?? []) as GlossaryTermIndexRow[];
  return rows.map((row) => rowToGlossaryTermNode({ ...row, withAttestations }));
};
