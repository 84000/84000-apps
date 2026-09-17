import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  CONTENT_SOURCES,
  searchWorkGlossaryTerms,
} from '@eightyfourthousand/data-access';
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
  source: z
    .enum(CONTENT_SOURCES)
    .optional()
    .describe(
      'Which copy to read: "published" (default) is the house rendering as published, which is what binds a translator; "draft" is the editor\u2019s current state, including terminology still under editorial review. A work still in preparation is reachable only under "draft".',
    ),
};

export function createSearchGlossaryTermsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'search-glossary-terms',
    description:
      'Search glossary terms within a work by name. Returns matching terms with names in all languages and definitions. Reads the published snapshot by default; pass source: "draft" for a work still in preparation.',
    inputSchema,
    annotations: {
      title: 'Search Glossary Terms',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ workUuid, query, limit, withAttestations, source }) => {
      const terms = await searchWorkGlossaryTerms({
        client,
        workUuid,
        query,
        limit,
        withAttestations,
        source,
      });
      return jsonResult(terms);
    },
  };
}
