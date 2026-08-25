import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { resolveToh } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  toh: z
    .string()
    .describe(
      'Tohoku number in any form — "Toh 312", "toh312", "T. 312", or a bare "312"',
    ),
};

export function createResolveTohTool(client: DataClient): McpToolDefinition {
  return {
    name: 'resolve-toh',
    description:
      'Resolve a Tohoku catalog number to the work and catalog entry it names, following aliases. Some numbers a translator cites are superseded numbers recorded only as a note — Toh 418 is catalogued as Toh 417 — and folio and passage reads key on the catalogued number, so they report an alias as simply not found. Call this first to tell an alias apart from a number that does not exist, and pass the returned `toh` onward. `placements` lists every number the work is catalogued under: more than one means the work sits at several distinct points in the canon, each with its own folios, not that the extras are aliases. Multiple results mean the number is genuinely ambiguous — report that rather than choosing.',
    inputSchema,
    annotations: {
      title: 'Resolve Tohoku Number',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ toh }) => {
      const resolutions = await resolveToh({ client, toh });
      if (resolutions.length === 0) {
        return errorResult(
          `No work is catalogued under, or cited as, "${toh}". Check the number rather than trying a nearby one.`,
        );
      }
      return jsonResult(resolutions);
    },
  };
}
