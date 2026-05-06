import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getWorkTitles } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  uuid: z.string().describe('The work UUID'),
};

export function createGetWorkTitlesTool(client: DataClient): McpToolDefinition {
  return {
    name: 'get-work-titles',
    description:
      'Get all titles for a work in different languages (English, Tibetan, Sanskrit, etc.).',
    inputSchema,
    annotations: {
      title: 'Get Work Titles',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid }) => {
      const titles = await getWorkTitles({ client, uuid });
      return jsonResult(titles);
    },
  };
}
