import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  CONTENT_SOURCES,
  searchCanonSectionGlossaryTerms,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  sectionUuid: z
    .uuid()
    .describe('Canonical section UUID, from search-canon-sections'),
  query: z
    .string()
    .describe(
      'Term to look up, in any of the glossed languages — English, Sanskrit (IAST), Wylie, Tibetan',
    ),
  includeDescendants: z
    .boolean()
    .optional()
    .describe(
      'Include works in subsections beneath this section (default true). Sections near the root of the canon hold no works of their own, so turning this off will often return nothing.',
    ),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Max glossary rows to consider (default 50, max 200)'),
  withAttestations: z
    .boolean()
    .optional()
    .describe('Include Sanskrit attestation variants'),
  source: z
    .enum(CONTENT_SOURCES)
    .optional()
    .describe(
      'Which copy to read: "published" (default) is the house rendering as published; "draft" also surfaces terminology in translations still under editorial review, which is not yet binding.',
    ),
};

export function createSearchCanonSectionGlossaryTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'search-canon-section-glossary',
    description:
      'Look up how a term is glossed across every work in a canonical section of the Kangyur/Tengyur — the escalation when a term is not in the glossary of the work being worked on, and a canon-section neighbour is the closest comparable authority. Results are grouped one entry per work, in Tohoku order, each with the work title and catalogue numbers. Use search-canon-sections first to resolve a section name to a uuid. For a single work, use get-glossary-instances or search-glossary-terms instead.',
    inputSchema,
    annotations: {
      title: 'Search Canon Section Glossary',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({
      sectionUuid,
      query,
      includeDescendants,
      limit,
      withAttestations,
      source,
    }) => {
      const works = await searchCanonSectionGlossaryTerms({
        client,
        sectionUuid,
        query,
        includeDescendants,
        limit,
        withAttestations,
        source,
      });
      return jsonResult(works);
    },
  };
}
