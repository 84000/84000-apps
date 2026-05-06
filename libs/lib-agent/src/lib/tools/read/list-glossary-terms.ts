import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getWorkGlossaryTermsPage } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  workUuid: z.string().uuid().describe('The work UUID'),
  limit: z.number().int().positive().optional().describe('Page size (default 50, max 200)'),
  cursor: z.string().optional().describe('Pagination cursor'),
  direction: z
    .enum(['FORWARD', 'BACKWARD', 'AROUND'])
    .optional()
    .describe('Pagination direction'),
  withAttestations: z
    .boolean()
    .optional()
    .describe('Include Sanskrit attestation variants'),
};

export function createListGlossaryTermsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'list-glossary-terms',
    description:
      'List glossary terms for a work with pagination. Returns term names, definitions, and page info.',
    inputSchema,
    annotations: {
      title: 'List Glossary Terms',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ workUuid, limit, cursor, direction, withAttestations }) => {
      const page = await getWorkGlossaryTermsPage({
        client,
        workUuid,
        limit,
        cursor,
        direction,
        withAttestations,
      });
      return jsonResult(page);
    },
  };
}
