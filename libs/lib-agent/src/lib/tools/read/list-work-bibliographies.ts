import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getBibliographyEntries } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  uuid: z.string().uuid().describe('The work UUID'),
};

export function createListWorkBibliographiesTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'list-work-bibliographies',
    description:
      'List all bibliography entries for a work, grouped by heading.',
    inputSchema,
    annotations: {
      title: 'List Work Bibliographies',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid }) => {
      const entries = await getBibliographyEntries({ client, uuid });
      return jsonResult(entries);
    },
  };
}
