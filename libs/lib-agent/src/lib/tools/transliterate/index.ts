import { z } from 'zod';
import {
  toEwtsWithWarnings,
  type FinalShad,
} from '@eightyfourthousand/lib-tibetan';
import type { McpToolDefinition } from '../../types';
import { jsonResult } from '../read/util';

export const TRANSLITERATE_TOOL_NAME = 'transliterate';

/** Long enough for a folio or a colophon, short enough to stay a one-off. */
const MAX_TEXT_LENGTH = 20_000;

const FINAL_SHAD: [FinalShad, FinalShad] = ['keep', 'drop'];

const inputSchema = {
  text: z
    .string()
    .min(1)
    .max(MAX_TEXT_LENGTH)
    .describe(
      'Tibetan Unicode to transliterate. Anything outside the Tibetan block (Latin, digits, folio labels, line breaks) passes through unchanged.',
    ),
  finalShad: z
    .enum(FINAL_SHAD)
    .default('keep')
    .describe(
      '`keep` (default) for a quoted passage, where the final shad is part of the text. `drop` for a title, term or name quoted on its own: trailing shads, tshegs and spaces are removed.',
    ),
};

/**
 * `transliterate`: Tibetan Unicode to EWTS in the house profile. Pure, so it
 * needs no data access and no permission.
 */
export function createTransliterateTool(): McpToolDefinition {
  return {
    name: TRANSLITERATE_TOOL_NAME,
    description:
      "Transliterate Tibetan Unicode to Extended Wylie (EWTS) in 84000's house profile (the `shared-policies/transliteration` policy): the a-chung as ’ (U+2019), Sanskrit with explicit stacking and capitals (b+ha, tan+t+ra, sha~M, pA Ni), native stacks written normally (bsgrub, badzra), and an ordinary space rather than _ after a shad. Use it instead of transliterating by hand. Set `finalShad` to `drop` for a title, term or name quoted on its own. The result is plain text: set it in italics where the policy says so, and check it against the Unicode before quoting it, starting with any `warnings`.",
    inputSchema,
    annotations: {
      title: 'Transliterate Tibetan to EWTS',
      readOnlyHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async (args) => {
      const { text, finalShad } = args as {
        text: string;
        finalShad: FinalShad;
      };
      const { ewts, warnings } = toEwtsWithWarnings(text, { finalShad });
      return jsonResult(warnings.length > 0 ? { ewts, warnings } : { ewts });
    },
  };
}
