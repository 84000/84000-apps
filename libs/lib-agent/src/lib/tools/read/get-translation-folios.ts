import { z } from 'zod';
import type {
  DataClient,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';
import {
  FOLIO_SIDES,
  getTranslationMetadataByUuid,
  getWorkFolios,
  getWorkFoliosAround,
  getWorkFoliosAt,
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
  folioNumber: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Address a folio the way it is cited — the number in "F.157b". Requires side. Use this instead of guessing a page offset from the folio number.',
    ),
  side: z
    .enum(FOLIO_SIDES)
    .optional()
    .describe('Folio side, the "b" in "F.157b". Required with folioNumber.'),
  volume: z
    .number()
    .int()
    .positive()
    .optional()
    .describe(
      'Pins the volume when a folio number recurs across volumes. Omitted, the lowest-numbered volume wins; every folio reports its own volume.',
    ),
  before: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Folios to include before the anchor. Defaults to 10 with folioUuid and 0 with folioNumber, where addressing one cited folio should return that folio. Ignored without an anchor.',
    ),
  after: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe(
      'Folios to include after the anchor. Defaults to 10 with folioUuid and 0 with folioNumber. Widen this to assemble a range from an addressed folio. Ignored without an anchor.',
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
      'Get the Tibetan source folios for a work by UUID or Tohoku number. Three ways to select: sequential pagination (page/size/offset), where a page shorter than size means the end of the work; a window centered on a folio UUID; or a folio addressed as it is cited, by folioNumber plus side (the "157" and "b" of "F.157b"), optionally widened with before/after. A UUID-centered or number-addressed window also reports whether more folios exist on either side. To assemble a range such as F.5a–F.7b, address the first folio and widen with after — folios run as sequential a/b pairs — then check hasMoreAfter and the returned folio/side values rather than assuming the window covered it. A Tohoku number that is an alias resolves to nothing here; run resolve-toh first.',
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
      folioNumber,
      side,
      volume,
      before,
      after,
    }) => {
      try {
        if ((folioNumber === undefined) !== (side === undefined)) {
          return errorResult(
            'folioNumber and side go together — a folio is cited as a number and a side, e.g. F.157b.',
          );
        }

        const source = await resolveFolioSource({ client, uuid, toh });
        if ('error' in source) {
          return errorResult(source.error);
        }

        if (folioNumber !== undefined && side !== undefined) {
          const at = await getWorkFoliosAt({
            client,
            uuid: source.workUuid,
            toh: source.toh,
            folioNumber,
            side,
            volume,
            before,
            after,
          });

          if (!at) {
            return errorResult(
              `No folio F.${folioNumber}${side} in ${source.toh}${
                volume === undefined ? '' : ` volume ${volume}`
              }. The work exists; this folio is not in it.`,
            );
          }

          return jsonResult({ ...source, ...at });
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
