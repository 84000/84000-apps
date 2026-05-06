import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  getTranslationMetadataByUuid,
  getTranslationMetadataByToh,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  uuid: z
    .string()
    .uuid()
    .optional()
    .describe('Work UUID — provide this or toh, not both'),
  toh: z
    .string()
    .optional()
    .describe('Tohoku catalog number (e.g. "1", "123") — provide this or uuid, not both'),
};

export function createGetTranslationTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-translation',
    description:
      'Get translation metadata (title, description, publication info, catalog numbers) by UUID or Tohoku number.',
    inputSchema,
    annotations: {
      title: 'Get Translation',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ uuid, toh }) => {
      if (!uuid && !toh) {
        return errorResult('Provide either uuid or toh.');
      }
      if (uuid && toh) {
        return errorResult('Provide only one of uuid or toh, not both.');
      }

      try {
        const work = uuid
          ? await getTranslationMetadataByUuid({ client, uuid })
          : await getTranslationMetadataByToh({ client, toh: toh! });

        if (!work) {
          return errorResult(
            `No translation found for ${uuid ? `UUID: ${uuid}` : `toh: ${toh}`}`,
          );
        }
        return jsonResult(work);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult(message);
      }
    },
  };
}
