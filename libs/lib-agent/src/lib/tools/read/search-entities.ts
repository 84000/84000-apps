import { z } from 'zod';
import {
  CONTENT_SOURCES,
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
      'Optional work UUID to scope passages, folios, bibliographies, and glossary terms. Omit it to search the whole corpus.',
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
  source: z
    .enum(CONTENT_SOURCES)
    .optional()
    .describe(
      'Which copy to search: "published" (default) is the house text as published, and what binds a translator; "draft" is the editorial copy, still under revision, and requires editor.read.',
    ),
};

export function createSearchEntitiesTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'search-entities',
    description:
      'Search across works, passages, folios, bibliographies, and glossary terms. Works are searched globally by title/toh; other types can be scoped to a work via workUuid (or folios via toh), and are searched across the whole library when neither is given — this is the cross-work search, and the tool to reach for on "which works discuss X?" or "where else does this phrase appear?". Every result carries the toh, title, and uuid of the work it came from, so a hit is citable without a second lookup. Cross-library passage results are ranked by relevance; within a single work they stay in document order. Reads the published snapshot unless asked for draft.',
    inputSchema,
    annotations: {
      title: 'Search Entities',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ query, workUuid, toh, types, limit, source }) => {
      const results = await searchEntities({
        client,
        query,
        workUuid,
        toh,
        types,
        limit,
        source,
      });
      return jsonResult(results);
    },
  };
}
