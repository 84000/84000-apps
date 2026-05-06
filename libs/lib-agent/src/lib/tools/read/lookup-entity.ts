import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { lookupEntityWithClient } from '@eightyfourthousand/data-access/ssr';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  type: z
    .enum(['bibliography', 'glossary', 'passage', 'translation', 'work'])
    .describe('The entity type'),
  entity: z
    .string()
    .describe(
      'Entity identifier — UUID for most types, or toh number for translations',
    ),
  xmlId: z
    .string()
    .optional()
    .describe('XML ID for passage lookup within a translation'),
};

export function createLookupEntityTool(client: DataClient): McpToolDefinition {
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
    handler: async ({ type, entity, xmlId }) => {
      const path = await lookupEntityWithClient({
        client,
        type,
        entity,
        xmlId,
      });
      if (!path) {
        return errorResult(`Could not resolve ${type} entity: ${entity}`);
      }
      return jsonResult({ path });
    },
  };
}
