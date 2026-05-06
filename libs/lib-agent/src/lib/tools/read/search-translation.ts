import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { search } from '@eightyfourthousand/lib-search';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  text: z.string().describe('Search query text'),
  uuid: z.string().uuid().describe('Work UUID to search within'),
  toh: z.string().describe('Tohoku catalog number of the work'),
  useRegex: z.boolean().optional().describe('Use regex search'),
};

export function createSearchTranslationTool(
  _client: DataClient,
): McpToolDefinition {
  return {
    name: 'search-translation',
    description:
      'Full-text search within a translation. Returns matching passages, alignments, bibliographies, and glossary entries.',
    inputSchema,
    annotations: {
      title: 'Search Translation',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ text, uuid, toh, useRegex }) => {
      const results = await search({ text, uuid, toh, useRegex });
      if (!results) {
        return errorResult('Search returned no results.');
      }
      return jsonResult(results);
    },
  };
}
