import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getGlossaryInstance } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  uuid: z.string().uuid().describe('The UUID of the glossary term'),
};

export function createGetGlossaryTermTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-glossary-term',
    description:
      'Retrieve a single glossary term by UUID, including names in all languages, definition, and attestations.',
    inputSchema,
    annotations: {
      title: 'Get Glossary Term',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid }) => {
      const term = await getGlossaryInstance({ client, uuid });
      if (!term) {
        return errorResult(`No glossary term found for UUID: ${uuid}`);
      }
      return jsonResult(term);
    },
  };
}
