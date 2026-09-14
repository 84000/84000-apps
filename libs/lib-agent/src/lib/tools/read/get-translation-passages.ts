import { z } from 'zod';
import type { DataClient, PassagesPage } from '@eightyfourthousand/data-access';
import {
  getTranslationPassages,
  getTranslationPassagesAround,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from './util';

const inputSchema = {
  uuid: z.uuid().describe('The work UUID'),
  type: z
    .string()
    .optional()
    .describe(
      'Passage type filter (e.g. "translation", "introduction", "(translation|introduction)")',
    ),
  cursor: z
    .string()
    .optional()
    .describe('Pagination cursor for sequential browsing'),
  passageUuid: z
    .string()
    .optional()
    .describe(
      'Center results around this passage UUID instead of paginating sequentially',
    ),
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
    .describe(
      'Character budget — stop returning passages once this limit is reached. Passage can vary widely in length.',
    ),
  direction: z
    .enum(['forward', 'backward'])
    .optional()
    .describe('Pagination direction (ignored when passageUuid is provided)'),
  includeAlignments: z
    .boolean()
    .optional()
    .describe(
      'Include each passage\u2019s Tibetan source alignments (default true). Set false to read the English alone — alignments fall outside maxCharacters and roughly double the response.',
    ),
};

/**
 * Drop the Tibetan alignments from a page.
 *
 * `maxCharacters` budgets passage content only, and the alignments are joined on
 * afterwards, so a page carries roughly twice the Tibetan-and-English text the
 * caller asked for. Stripping here rather than in the RPC keeps the reader's
 * compare view — which wants them — reading the same query.
 */
const withoutAlignments = (page: PassagesPage): PassagesPage => ({
  ...page,
  passages: page.passages.map(
    ({ alignments: _alignments, ...passage }) => passage,
  ),
});

export function createGetTranslationPassagesTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-translation-passages',
    description:
      'Get a page of passages for a translation. Supports sequential pagination (cursor + direction) or centering around a specific passage (passageUuid). Each passage carries its stored Tibetan source alignments unless includeAlignments is false; note that maxCharacters budgets the English content only, so a page including alignments runs to roughly twice that. To read alignments on their own — for a work, or for passages you already hold — use get-passage-alignments instead.',
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
      includeAlignments = true,
    }) => {
      const shape = (page: PassagesPage) =>
        includeAlignments ? page : withoutAlignments(page);

      if (passageUuid) {
        const page = await getTranslationPassagesAround({
          client,
          uuid,
          passageUuid,
          type,
          maxPassages,
          maxCharacters,
        });
        return jsonResult(shape(page));
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
      return jsonResult(shape(page));
    },
  };
}
