import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { getStandardDefinitionGaps } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from './util';

export const QA_GLOSSARY_STANDARD_DEFINITIONS_TOOL_NAME =
  'qa-glossary-standard-definitions';

const inputSchema = {
  workUuid: z
    .uuid()
    .describe('The work UUID (resolve a Toh number with resolve-toh first)'),
};

/**
 * Publication QA: glossary entries whose definition is hidden behind a
 * standard definition that does not exist yet. Reads the draft tables, so it is
 * for the studio server only, not the public read tools.
 */
export function createQaGlossaryStandardDefinitionsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: QA_GLOSSARY_STANDARD_DEFINITIONS_TOOL_NAME,
    description:
      'Publication QA for a work’s draft glossary. Finds entries set to "overrideWithStandard" whose own definition is a placeholder ("Use standard", "Use 84000 standard…") while their authority has no standard definition, so the live glossary shows an empty definition. Returns the count of placeholder entries, how many are covered by a standard definition (fine as is), and each gap with its glossary UUID, authority UUID, term, headword and placeholder text.',
    inputSchema,
    annotations: {
      title: 'QA: Glossary Standard Definitions',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ workUuid }) => {
      try {
        const report = await getStandardDefinitionGaps({ client, workUuid });
        return jsonResult(report);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };
}
