import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { searchWorkGlossaryTerms } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  workUuid: z.string().describe('The work UUID'),
  query: z.string().describe('Search query — matches against term names'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max results (default 20, max 50)'),
  withAttestations: z
    .boolean()
    .optional()
    .describe('Include Sanskrit attestation variants'),
};

export function createSearchGlossaryTermsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'search-glossary-terms',
    description:
      'Search glossary terms within a work by name. Returns matching terms with names in all languages and definitions.',
    inputSchema,
    annotations: {
      title: 'Search Glossary Terms',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ workUuid, query, limit, withAttestations }) => {
      const terms = await searchWorkGlossaryTerms({
        client,
        workUuid,
        query,
        limit,
        withAttestations,
      });
      return jsonResult(terms);
    },
  };
}
