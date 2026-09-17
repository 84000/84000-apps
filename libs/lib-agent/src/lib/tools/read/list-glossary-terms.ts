import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  CONTENT_SOURCES,
  getWorkGlossaryTermsPage,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  workUuid: z.string().describe('The work UUID'),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Page size (default 50, max 200)'),
  cursor: z.string().optional().describe('Pagination cursor'),
  direction: z
    .enum(['FORWARD', 'BACKWARD', 'AROUND'])
    .optional()
    .describe('Pagination direction'),
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

export function createListGlossaryTermsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'list-glossary-terms',
    description:
      'List glossary terms for a work with pagination. Returns term names, definitions, and page info. Reads the published snapshot by default; pass source: "draft" for a work still in preparation.',
    inputSchema,
    annotations: {
      title: 'List Glossary Terms',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({
      workUuid,
      limit,
      cursor,
      direction,
      withAttestations,
      source,
    }) => {
      const page = await getWorkGlossaryTermsPage({
        client,
        workUuid,
        limit,
        cursor,
        direction,
        withAttestations,
        source,
      });
      return jsonResult(page);
    },
  };
}
