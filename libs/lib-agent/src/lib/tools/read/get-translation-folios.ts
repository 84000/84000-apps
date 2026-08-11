import { z } from 'zod';
import type {
  DataClient,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';
import {
  getTranslationMetadataByUuid,
  getWorkFolios,
  getWorkFoliosAround,
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
      'Tohoku catalog number (e.g. "toh1", "toh417") naming the source edition — provide this or uuid. When omitted, the work\'s first Tohoku number is used.',
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
    .describe('Number of folios per page (default 10)'),
  offset: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Absolute offset into the ordered folio list — takes precedence over page',
    ),
  folioUuid: z
    .string()
    .optional()
    .describe(
      'Center results around this folio UUID instead of paginating sequentially',
    ),
  before: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Folios to include before folioUuid (default 10, ignored without folioUuid)',
    ),
  after: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Folios to include after folioUuid (default 10, ignored without folioUuid)',
    ),
};

type FolioSource = { workUuid: string; toh: TohokuCatalogEntry };

/**
 * Resolve the work UUID / Tohoku pair that folio queries require from whichever
 * identifier the caller supplied. Folios are keyed by both, so a missing half is
 * looked up: uuid from the Tohoku number, or Tohoku number from the work. A work
 * can carry several Tohoku numbers — the first is used, so callers pin a
 * specific source edition by passing `toh` explicitly.
 */
async function resolveFolioSource({
  client,
  uuid,
  toh,
}: {
  client: DataClient;
  uuid?: string;
  toh?: string;
}): Promise<FolioSource | { error: string }> {
  if (!uuid && !toh) {
    return { error: 'Provide either uuid or toh.' };
  }

  // Per the guard above, toh is present whenever uuid is not.
  const workUuid =
    uuid ?? (await getWorkUuidByToh({ client, toh: toh as string }));
  if (!workUuid) {
    return { error: `No work found for toh: ${toh}` };
  }

  if (toh) {
    return { workUuid, toh: toh as TohokuCatalogEntry };
  }

  const work = await getTranslationMetadataByUuid({ client, uuid: workUuid });
  const [firstToh] = work?.toh ?? [];
  if (!firstToh) {
    return {
      error: `No Tohoku number found for UUID: ${workUuid}. Provide toh explicitly.`,
    };
  }

  return { workUuid, toh: firstToh };
}

/**
 * MCP tool exposing the Tibetan source folios behind a translation, either as
 * sequential pages or as a window centered on one folio.
 */
export function createGetTranslationFoliosTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'get-translation-folios',
    description:
      'Get the Tibetan source folios for a work by UUID or Tohoku number. Supports sequential pagination (page/size/offset), where a page shorter than size means the end of the work, or centering around a specific folio (folioUuid), which also reports whether more folios exist on either side.',
    inputSchema,
    annotations: {
      title: 'Get Translation Folios',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({
      uuid,
      toh,
      page,
      size,
      offset,
      folioUuid,
      before,
      after,
    }) => {
      try {
        const source = await resolveFolioSource({ client, uuid, toh });
        if ('error' in source) {
          return errorResult(source.error);
        }

        if (folioUuid) {
          const around = await getWorkFoliosAround({
            client,
            uuid: source.workUuid,
            toh: source.toh,
            folioUuid,
            before,
            after,
          });

          if (!around) {
            return errorResult(
              `No folio found for UUID: ${folioUuid} in ${source.toh}`,
            );
          }

          return jsonResult({ ...source, ...around });
        }

        const folios = await getWorkFolios({
          client,
          uuid: source.workUuid,
          toh: source.toh,
          page,
          size,
          offset,
        });

        return jsonResult({ ...source, folios });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult(message);
      }
    },
  };
}
