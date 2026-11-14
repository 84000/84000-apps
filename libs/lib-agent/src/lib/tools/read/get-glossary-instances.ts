import { z } from 'zod';
import type {
  ContentSource,
  DataClient,
} from '@eightyfourthousand/data-access';
import {
  CONTENT_SOURCES,
  DEFAULT_CONTENT_SOURCE,
  getGlossaryInstances,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  uuid: z.uuid().describe('The work UUID'),
  withAttestations: z
    .boolean()
    .optional()
    .describe('Include Sanskrit attestation variants'),
  source: z
    .enum(CONTENT_SOURCES)
    .optional()
    .describe(
      'Which copy to read: "published" is the glossary as published; "draft" is the editor’s current state, which needs editor access. Defaults to the server’s copy.',
    ),
};

export type GetGlossaryInstancesToolOptions = {
  /** The copy read when a call gives no `source`; published by default. */
  source?: ContentSource;
};

export function createGetGlossaryInstancesTool(
  client: DataClient,
  {
    source: defaultSource = DEFAULT_CONTENT_SOURCE,
  }: GetGlossaryInstancesToolOptions = {},
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
    handler: async ({ uuid, withAttestations, source }) => {
      const instances = await getGlossaryInstances({
        client,
        uuid,
        withAttestations,
        source: source ?? defaultSource,
      });
      return jsonResult(instances);
    },
  };
}
