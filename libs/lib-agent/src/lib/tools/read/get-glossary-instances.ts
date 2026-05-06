import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getGlossaryInstances } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  uuid: z.uuid().describe('The work UUID'),
  withAttestations: z
    .boolean()
    .optional()
    .describe('Include Sanskrit attestation variants'),
};

export function createGetGlossaryInstancesTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-glossary-instances',
    description:
      'Get all glossary term instances for a work, sorted alphabetically by English name.',
    inputSchema,
    annotations: {
      title: 'Get Glossary Instances',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid, withAttestations }) => {
      const instances = await getGlossaryInstances({
        client,
        uuid,
        withAttestations,
      });
      return jsonResult(instances);
    },
  };
}
