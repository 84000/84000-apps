import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  CONTENT_SOURCES,
  getGlossaryInstance,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  uuid: z.uuid().describe('The UUID of the glossary term'),
  source: z
    .enum(CONTENT_SOURCES)
    .optional()
    .describe(
      'Which copy to read: "published" (default) is the house rendering as published, which is what binds a translator; "draft" is the editor\u2019s current state, including terminology still under editorial review. A work still in preparation is reachable only under "draft".',
    ),
};

export function createGetGlossaryTermTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-glossary-term',
    description:
      'Retrieve a single glossary term by UUID, including names in all languages, definition, and attestations. Reads the published snapshot by default; pass source: "draft" for a work still in preparation.',
    inputSchema,
    annotations: {
      title: 'Get Glossary Term',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid, source }) => {
      const term = await getGlossaryInstance({ client, uuid, source });
      if (!term) {
        return errorResult(`No glossary term found for UUID: ${uuid}`);
      }
      return jsonResult(term);
    },
  };
}
