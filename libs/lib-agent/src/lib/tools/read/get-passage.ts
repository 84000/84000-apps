import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getPassage } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  uuid: z.string().uuid().describe('The UUID of the passage'),
};

export function createGetPassageTool(client: DataClient): McpToolDefinition {
  return {
    name: 'get-passage',
    description:
      'Retrieve a single passage by UUID, including its content, annotations, and metadata.',
    inputSchema,
    annotations: { title: 'Get Passage', readOnlyHint: true, openWorldHint: false },
    handler: async ({ uuid }) => {
      const passage = await getPassage({ client, uuid });
      if (!passage) {
        return errorResult(`No passage found for UUID: ${uuid}`);
      }
      return jsonResult(passage);
    },
  };
}
