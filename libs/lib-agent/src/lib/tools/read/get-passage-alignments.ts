import { z } from 'zod';
import type {
  DataClient,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';
import {
  getPassageAlignments,
  getWorkAlignments,
  getWorkUuidByToh,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  uuid: z.string().optional().describe('Work UUID — provide this or toh'),
  toh: z
    .string()
    .optional()
    .describe(
      'Tohoku catalog number (e.g. "toh1", "toh417") — provide this or uuid. Also pins the source edition when a work is catalogued under several numbers.',
    ),
  passageUuids: z
    .array(z.string())
    .optional()
    .describe(
      'Fetch the alignments for these specific passages instead of paging the work. Use this when you already have passage UUIDs from get-translation-passages or search-translation.',
    ),
  includeEnglish: z
    .boolean()
    .optional()
    .describe(
      'Include the English passage text alongside the Tibetan (default false). Leave it off when you already have the English — it roughly doubles the response.',
    ),
  page: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('Zero-based page index (default 0)'),
  size: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Passages per page, capped at 200 (default 20). This counts passages, not alignments — unaligned passages occupy a slot and return nothing.',
    ),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Absolute offset into the work’s ordered passages — takes precedence over page. Pass back the nextOffset from a previous response to continue.',
    ),
};

/**
 * MCP tool exposing the stored passage alignments — the Tibetan source span
 * behind each translated passage — without the English content that
 * `get-translation-passages` returns alongside them.
 */
export function createGetPassageAlignmentsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-passage-alignments',
    description:
      'Get the stored alignments for a work: the span of Tibetan source text behind each translated passage, with the folio and volume it falls on. These are recorded alignments, not ones you derive — prefer this over reading folios and matching the Tibetan yourself. Returns Tibetan only by default, so it is the cheap way to add the source to English you already have; pass includeEnglish to get both and build a side-by-side. Address a work by uuid or toh, or pass passageUuids to fetch alignments for specific passages you already hold. Paging runs in passage reading order, and size counts passages rather than alignments: unaligned passages such as front matter occupy a slot and contribute nothing, so a short or even empty page does not mean the end of the work — read hasMore, and pass nextOffset back to continue. An empty result for a whole work means the work has no recorded alignments, not that it has no Tibetan source; get-translation-folios still has the folios.',
    inputSchema,
    annotations: {
      title: 'Get Passage Alignments',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({
      uuid,
      toh,
      passageUuids,
      includeEnglish,
      page,
      size,
      offset,
    }) => {
      try {
        if (passageUuids?.length) {
          const byPassage = await getPassageAlignments({
            client,
            passageUuids,
            toh: toh as TohokuCatalogEntry | undefined,
            includeEnglish,
          });

          // Report in the order the caller asked for, and say plainly which of
          // their passages carry no alignment rather than dropping them.
          const requested = passageUuids as string[];
          const alignments = requested.flatMap(
            (passageUuid) => byPassage.get(passageUuid) ?? [],
          );
          const unaligned = requested.filter(
            (passageUuid) => !byPassage.has(passageUuid),
          );

          return jsonResult({ alignments, unaligned });
        }

        if (!uuid && !toh) {
          return errorResult('Provide uuid, toh, or passageUuids.');
        }

        const workUuid =
          uuid ?? (await getWorkUuidByToh({ client, toh: toh as string }));
        if (!workUuid) {
          return errorResult(`No work found for toh: ${toh}`);
        }

        const result = await getWorkAlignments({
          client,
          uuid: workUuid,
          toh: toh as TohokuCatalogEntry | undefined,
          page,
          size,
          offset,
          includeEnglish,
        });

        return jsonResult({ workUuid, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult(message);
      }
    },
  };
}
