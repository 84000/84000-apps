import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { resolveToh } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

const inputSchema = {
  toh: z
    .string()
    .describe(
      'Tohoku number in any form — "Toh 312", "toh312", "T. 312", a bare "312", a subdivision like "toh1-1", or a lettered entry like "toh1059a"',
    ),
};

export function createResolveTohTool(client: DataClient): McpToolDefinition {
  return {
    name: 'resolve-toh',
    description:
      'Resolve a Tohoku catalog number to the work and catalog entry it names. A cited number is often not an entry: it can be a superseded number (Toh 418 is catalogued as Toh 417), or one of several a single entry covers — Toh 1069 covers Toh 1069–1073, and Toh 539 covers Toh 539a–d. Folio and passage reads key on the catalogued number, so every one of those reads as a missing work until resolved. Call this first to tell such a number apart from one that does not exist, then pass the returned `toh` onward. `alias` says whether the number was reached through an entry note rather than being an entry itself. `placements` lists every number the work is catalogued under: more than one means the work sits at several distinct points in the canon, each with its own folios, not that the extras are aliases. Multiple results mean the number is genuinely ambiguous — report that rather than choosing.',
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
