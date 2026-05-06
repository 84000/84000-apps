import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getTranslationImprint } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  uuid: z.uuid().describe('The work UUID'),
  toh: z.string().describe('Tohoku catalog number (e.g. "toh1", "toh123")'),
};

export function createGetImprintTool(client: DataClient): McpToolDefinition {
  return {
    name: 'get-imprint',
    description:
      'Get the imprint (publication metadata, license, contributors) for a translation.',
    inputSchema,
    annotations: {
      title: 'Get Imprint',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid, toh }) => {
      const imprint = await getTranslationImprint({ client, uuid, toh });
      if (!imprint) {
        return errorResult(`No imprint found for work ${uuid}, ${toh}`);
      }
      return jsonResult(imprint);
    },
  };
}
