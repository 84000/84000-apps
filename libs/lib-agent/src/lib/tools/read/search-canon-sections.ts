import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { searchCanonSections } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  query: z
    .string()
    .describe(
      'Section name to search for, e.g. "Action Tantra", "Perfection of Wisdom", "Vinaya". Matched without regard to diacritics, so "Sutra" finds "Sūtra". Alternate-language names are searched too.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max results (default 20, max 50)'),
};

export function createSearchCanonSectionsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'search-canon-sections',
    description:
      'Find canonical sections of the Kangyur or Tengyur by name. Returns each match with its parent section, Tohoku range, whether it has subsections, and how many works it holds directly versus across its whole subtree. Several matches are normal — "Action Tantra" names both a Kangyur and a Tengyur section — so check the parent and Tohoku range before choosing, and ask rather than guessing when the request is ambiguous. Use the returned uuid with search-canon-section-glossary.',
    inputSchema,
    annotations: {
      title: 'Search Canon Sections',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ query, limit }) => {
      const sections = await searchCanonSections({ client, query, limit });
      return jsonResult(sections);
    },
  };
}
