import { z } from 'zod';
import type { DataClient, WorkEditOp } from '@eightyfourthousand/data-access';
import { applyWorkEdits, hasPermission } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from '../read/util';
import {
  importAnnotationSchema,
  importPassageSchema,
  importTitleSchema,
} from './apply-entity-import';
import { passageEditSchema } from './apply-passage-edits';

const expectSchema = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(
    'Stored values this op expects, by field, as you last read them. The call is refused before anything is written if any differs, so a stale read cannot overwrite a newer change.',
  );

const opSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('update-work'),
    patch: z
      .record(z.string(), z.unknown())
      .describe(
        'Partial works-row patch, e.g. { "toh": "toh44" } or { "restriction": true }. Several are merged in list order.',
      ),
    expect: expectSchema,
  }),
  z.object({
    op: z.literal('upsert-title'),
    title: importTitleSchema.describe(
      'The title for a slot: (type, language) when a language is given, else (type, content). A filled slot is updated; an empty one is inserted.',
    ),
    expect: expectSchema.describe(
      'Stored values of the title in that slot, e.g. { "content": "<current title>" }. The call is refused if any differs.',
    ),
  }),
  z.object({
    op: z.literal('upsert-folio-annotation'),
    patch: z
      .record(z.string(), z.unknown())
      .describe(
        'Patch for the work-level folio annotations. Only { "source_description": "..." } may be set.',
      ),
    expect: expectSchema,
  }),
  z.object({
    op: z.literal('upsert-passage'),
    passage: importPassageSchema,
    annotations: z
      .array(importAnnotationSchema)
      .optional()
      .describe(
        'The full annotation set of this passage. Stored annotations not sent are deleted.',
      ),
  }),
  ...passageEditSchema.options,
]);

const inputSchema = {
  workUuid: z.string().describe('UUID of the work being edited.'),
  ops: z
    .array(opSchema)
    .describe(
      'Ops to apply. update-work, upsert-title and upsert-folio-annotation edit the work metadata. upsert-passage writes whole passages, as an import does; delete-text, add-annotation, remove-annotation and insert-passage edit stored passages. Do not mix upsert-passage with the edit ops in one call. Edit offsets are read in the coordinates of the stored passage, before any edit in this list is applied.',
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      'Plan every op against stored state and return the planned changes without writing. Use this to show the editor what would change.',
    ),
};

/**
 * Write tool that edits a work from one list of ops: its metadata and its
 * passages. Requires `editor.edit`.
 */
export function createApplyWorkEditsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'apply-work-edits',
    description:
      'Edit a work: its metadata (works row, titles, folio source description) and its passages, from one list of ops. Use it both to fill an empty work from an import and to edit a work that already has content. Ops fall into groups (work-metadata, then passages); every op is planned against stored state before anything is written, and a refused op writes nothing. Groups then commit in that order, each on its own, and the first that fails stops the call: earlier groups stay written, later ones are listed in notAttempted. The passages group is all-or-nothing; work-metadata is not. A group whose applied is "unknown" may be partly written: re-read before issuing anything again, and never retry blindly. Send expect, or text on passage edits, with values you read so a stale read is refused. Run with dryRun first and show the editor the result before writing. Requires editor permissions.',
    inputSchema,
    annotations: {
      title: 'Apply Work Edits',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: async ({ workUuid, ops, dryRun }) => {
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
        const result = await applyWorkEdits({
          client,
          workUuid,
          ops: ops as WorkEditOp[],
          dryRun,
        });
        return result.success
          ? jsonResult(result)
          : { ...jsonResult(result), isError: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult(message);
      }
    },
  };
}
