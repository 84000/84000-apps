import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  DEFINITION_RENDS,
  hasPermission,
  updateGlossaryDefinition,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from '../read/util';

const inputSchema = {
  workUuid: z.uuid().describe('UUID of the work the entry belongs to.'),
  glossaryUuid: z.uuid().describe('The glossary entry to update.'),
  definition: z
    .string()
    .min(1)
    .describe('The new definition, as the editor approved it.'),
  definitionRend: z
    .enum(DEFINITION_RENDS)
    .optional()
    .describe(
      'How the definition combines with the authority’s standard definition. Omit it: the default, "incompatibleWithStandard", shows this definition alone, which is what an entry that had deferred to a missing standard needs.',
    ),
  expectedDefinition: z
    .string()
    .nullable()
    .describe(
      'The entry’s current definition exactly as last read (e.g. the placeholder from qa-glossary-standard-definitions). The write is refused if it has changed.',
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      'Check and return the change without writing it. Use this to show the editor what would change.',
    ),
};

/** Write tool for a glossary entry's own definition. Requires `editor.edit`. */
export function createUpdateGlossaryDefinitionTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'update-glossary-definition',
    description:
      'Set a glossary entry’s own definition in the draft, and how it combines with the standard definition ("incompatibleWithStandard" by default: this definition alone, the standard ignored). Refused if the entry is not in the given work or its definition is no longer expectedDefinition. Run with dryRun first, show the editor the before and after, and write only once they approve. The change reaches the reader when the work is next published. Requires editor permissions.',
    inputSchema,
    annotations: {
      title: 'Update Glossary Definition',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async ({
      workUuid,
      glossaryUuid,
      definition,
      definitionRend,
      expectedDefinition,
      dryRun,
    }) => {
      const allowed = await hasPermission({
        client,
        permission: 'editor.edit',
      });
      if (!allowed) {
        return errorResult(
          'This tool requires the editor.edit permission on the current account.',
        );
      }

      try {
        const result = await updateGlossaryDefinition({
          client,
          workUuid,
          glossaryUuid,
          definition,
          definitionRend,
          expectedDefinition,
          dryRun,
        });
        if (!result.ok) {
          return errorResult(
            result.current
              ? `${result.error}\nCurrent: ${JSON.stringify(result.current)}`
              : result.error,
          );
        }
        return jsonResult(result);
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };
}
