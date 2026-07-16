import { z } from 'zod';
import {
  searchEntities,
  type DataClient,
  type EntitySearchResultType,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const ENTITY_TYPES = [
  'work',
  'passage',
  'folio',
  'bibliography',
  'glossary',
] as const satisfies readonly EntitySearchResultType[];

const inputSchema = {
  query: z.string().describe('Search query text'),
  workUuid: z
    .string()
    .optional()
    .describe(
      'Optional work UUID to scope passages, folios, bibliographies, and glossary terms',
    ),
  toh: z
    .string()
    .optional()
    .describe('Optional Tohoku catalog number to scope folios'),
  types: z
    .array(z.enum(ENTITY_TYPES))
    .optional()
    .describe('Optional list of entity types to restrict the search to'),
  limit: z
    .number()
    .optional()
    .describe('Maximum number of results (1-50, defaults to 20)'),
};

export function createSearchEntitiesTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'search-entities',
    description:
      'Search across works, passages, folios, bibliographies, and glossary terms. Works are searched globally by title/toh; other types can be scoped to a work via workUuid (or folios via toh).',
    inputSchema,
    annotations: {
      title: 'Search Entities',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ query, workUuid, toh, types, limit }) => {
      const results = await searchEntities({
        client,
        query,
        workUuid,
        toh,
        types,
        limit,
      });
      return jsonResult(results);
    },
  };
}
