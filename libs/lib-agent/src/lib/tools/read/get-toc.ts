import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getTranslationToc } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  uuid: z.uuid().describe('The work UUID'),
};

export function createGetTocTool(client: DataClient): McpToolDefinition {
  return {
    name: 'get-toc',
    description:
      'Get the table of contents for a translation, organized into front matter, body, and back matter.',
    inputSchema,
    annotations: {
      title: 'Get Table of Contents',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid }) => {
      const toc = await getTranslationToc({ client, uuid });
      if (!toc) {
        return errorResult(`No table of contents found for work: ${uuid}`);
      }
      return jsonResult(toc);
    },
  };
}
