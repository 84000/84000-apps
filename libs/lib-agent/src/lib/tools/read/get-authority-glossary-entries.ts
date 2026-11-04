import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  CONTENT_SOURCES,
  MAX_AUTHORITY_UUIDS,
  getAuthorityGlossaryEntries,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  authorityUuids: z
    .array(z.uuid())
    .min(1)
    .max(MAX_AUTHORITY_UUIDS)
    .describe(
      `Authority UUIDs (the shared identity of a term, as on a glossary entry). Up to ${MAX_AUTHORITY_UUIDS}.`,
    ),
  excludeWorkUuid: z
    .uuid()
    .optional()
    .describe(
      'Leave out this work’s own entries, e.g. the work being checked.',
    ),
  includeEmpty: z
    .boolean()
    .optional()
    .describe('Also return entries whose definition is empty (default false).'),
  source: z
    .enum(CONTENT_SOURCES)
    .optional()
    .describe(
      'Which copy to read: "published" (default) is each work’s glossary as published, with any standard definition already applied; "draft" adds works in preparation and terminology still under review.',
    ),
};

export function createGetAuthorityGlossaryEntriesTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-authority-glossary-entries',
    description:
      'For one or more glossary authorities, list every work’s glossary entry for that same term, with the work (toh, title), the term’s names and its definition. An exact lookup by authority, not a text search. Use it to find how other works have defined a term, e.g. to supply a definition where a work defers to a standard definition that does not exist yet. Returns only entries with a definition unless includeEmpty is set.',
    inputSchema,
    annotations: {
      title: 'Get Authority Glossary Entries',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({
      authorityUuids,
      excludeWorkUuid,
      includeEmpty,
      source,
    }) => {
      try {
        return jsonResult(
          await getAuthorityGlossaryEntries({
            client,
            authorityUuids,
            excludeWorkUuid,
            includeEmpty,
            source,
          }),
        );
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };
}
