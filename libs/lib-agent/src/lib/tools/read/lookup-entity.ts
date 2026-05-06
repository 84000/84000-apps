import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { lookupEntity } from '@eightyfourthousand/data-access/ssr';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  type: z
    .enum(['bibliography', 'glossary', 'passage', 'translation', 'work'])
    .describe('The entity type'),
  entity: z
    .string()
    .describe('Entity identifier — UUID for most types, or toh number for translations'),
  prefix: z.string().optional().describe('URL path prefix'),
  xmlId: z
    .string()
    .optional()
    .describe('XML ID for passage lookup within a translation'),
};

export function createLookupEntityTool(
  _client: DataClient,
): McpToolDefinition {
  return {
    name: 'lookup-entity',
    description:
      'Resolve an entity to its reader URL path. Returns the path to view the entity in the reader application.',
    inputSchema,
    annotations: {
      title: 'Lookup Entity',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ type, entity, prefix, xmlId }) => {
      const path = await lookupEntity({ type, entity, prefix, xmlId });
      if (!path) {
        return errorResult(
          `Could not resolve ${type} entity: ${entity}`,
        );
      }
      return jsonResult({ path });
    },
  };
}
