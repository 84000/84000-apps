import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  CONTENT_SOURCES,
  getGlossaryTermContexts,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  glossaryUuid: z.uuid().describe('The glossary term UUID'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(20)
    .optional()
    .describe('Passages to return (default 5, max 20)'),
  window: z
    .number()
    .int()
    .min(50)
    .max(1000)
    .optional()
    .describe('Characters of text either side of each use (default 250)'),
  source: z
    .enum(CONTENT_SOURCES)
    .optional()
    .describe(
      'Which copy to read: "published" (default) or "draft". A work still in preparation is reachable only under "draft", and draft requires editor.read.',
    ),
};

export function createGetGlossaryTermContextsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-glossary-term-contexts',
    description:
      'Show how a glossary term is used in its work: the passages that cite it, each cut to a short window around every use, with the term marked «like this». Use it to judge the sense a work gives a term. Empty when the term has no glossary-instance annotations (a child name, or instances not yet resolved); then search the text for the term with search-translation.',
    inputSchema,
    annotations: {
      title: 'Get Glossary Term Contexts',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ glossaryUuid, limit, window, source }) =>
      jsonResult(
        await getGlossaryTermContexts({
          client,
          glossaryUuid,
          limit,
          window,
          source,
        }),
      ),
  };
}
