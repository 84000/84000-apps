import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  getTranslationPassages,
  getTranslationPassagesAround,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  uuid: z.string().uuid().describe('The work UUID'),
  type: z
    .string()
    .optional()
    .describe('Passage type filter (e.g. "translation", "introduction")'),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for sequential browsing'),
  passageUuid: z
    .string()
    .uuid()
    .optional()
    .describe('Center results around this passage UUID instead of paginating sequentially'),
  maxPassages: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Maximum number of passages to return'),
  maxCharacters: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Character budget — stop returning passages once this limit is reached'),
  direction: z
    .enum(['forward', 'backward'])
    .optional()
    .describe('Pagination direction (ignored when passageUuid is provided)'),
};

export function createGetTranslationPassagesTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-translation-passages',
    description:
      'Get a page of passages for a translation. Supports sequential pagination (cursor + direction) or centering around a specific passage (passageUuid).',
    inputSchema,
    annotations: {
      title: 'Get Translation Passages',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({
      uuid,
      type,
      cursor,
      passageUuid,
      maxPassages,
      maxCharacters,
      direction,
    }) => {
      if (passageUuid) {
        const page = await getTranslationPassagesAround({
          client,
          uuid,
          passageUuid,
          type,
          maxPassages,
          maxCharacters,
        });
        return jsonResult(page);
      }

      const page = await getTranslationPassages({
        client,
        uuid,
        type,
        cursor,
        maxPassages,
        maxCharacters,
        direction,
      });
      return jsonResult(page);
    },
  };
}
