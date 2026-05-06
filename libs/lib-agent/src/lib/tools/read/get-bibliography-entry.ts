import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getBibliographyEntry } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  uuid: z.string().uuid().describe('The UUID of the bibliography entry'),
};

export function createGetBibliographyEntryTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-bibliography-entry',
    description: 'Retrieve a single bibliography entry by UUID.',
    inputSchema,
    annotations: {
      title: 'Get Bibliography Entry',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid }) => {
      const entry = await getBibliographyEntry({ client, uuid });
      if (!entry) {
        return errorResult(`No bibliography entry found for UUID: ${uuid}`);
      }
      return jsonResult(entry);
    },
  };
}
