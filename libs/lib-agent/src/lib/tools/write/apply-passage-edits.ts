import { z } from 'zod';
import type { DataClient, PassageEdit } from '@eightyfourthousand/data-access';
import { applyPassageEdits, hasPermission } from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from '../read/util';

const editSchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('delete-text'),
    passageUuid: z.string().describe('Passage to edit.'),
    start: z
      .number()
      .int()
      .nonnegative()
      .describe('Inclusive offset into the stored content.'),
    end: z
      .number()
      .int()
      .nonnegative()
      .describe('Exclusive offset into the stored content.'),
  }),
  z.object({
    op: z.literal('add-annotation'),
    passageUuid: z.string().describe('Passage to annotate.'),
    kind: z
      .string()
      .describe(
        'Annotation kind, e.g. mention, glossary-instance, end-note-link, span, link, heading.',
      ),
    start: z
      .number()
      .int()
      .nonnegative()
      .describe('Offset into the stored content, before any edit is applied.'),
    end: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe(
        'Exclusive end offset. Omit for a zero-length marker such as a folio mention.',
      ),
    data: z
      .record(z.string(), z.unknown())
      .optional()
      .describe(
        'Kind-specific attributes, e.g. { "entity": "<uuid>", "linkType": "folio", "isSameWork": true } for a folio mention.',
      ),
  }),
  z.object({
    op: z.literal('remove-annotation'),
    passageUuid: z.string().describe('Passage the annotation belongs to.'),
    annotationUuid: z.string().describe('Annotation to remove.'),
  }),
  z.object({
    op: z.literal('insert-passage'),
    before: z
      .string()
      .describe(
        'Existing passage the new one goes before. It takes that passage sort; the save path opens the slot.',
      ),
    content: z.string().describe('Plain text content of the new passage.'),
    label: z
      .string()
      .optional()
      .describe('Passage label. Omit for an unlabelled passage.'),
    type: z
      .string()
      .optional()
      .describe('Passage type. Defaults to the type of the anchor passage.'),
  }),
]);

const inputSchema = {
  workUuid: z.string().describe('UUID of the work being edited.'),
  edits: z
    .array(editSchema)
    .describe(
      'Edits to apply. Offsets are read in the coordinates of the stored passage, before any edit in this list is applied.',
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      'Compute and return the result without writing it. Use this to show the editor what would change.',
    ),
};

/**
 * Write tool that edits passages of a work that already has content, expressed
 * as deltas rather than whole passages. Offset re-mapping, annotation
 * preservation and the save are handled here. Requires `editor.edit`.
 */
export function createApplyPassageEditsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'apply-passage-edits',
    description:
      'Edit passages of a work that already has content. Send what to change — delete a span of text, add or remove an annotation, insert a passage — and the offsets of every other annotation on those passages are re-mapped for you, with the ones you do not name carried through untouched. All offsets are read in the coordinates of the stored passage, so you never account for what your own edits moved. Use apply-entity-import instead to fill an empty work. Run with dryRun first and show the editor the result before writing. Requires editor permissions.',
    inputSchema,
    annotations: {
      title: 'Apply Passage Edits',
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: async ({ workUuid, edits, dryRun }) => {
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
        const result = await applyPassageEdits({
          client,
          workUuid,
          edits: edits as PassageEdit[],
          dryRun,
        });

        if (!result.success) {
          return errorResult(result.error ?? 'Failed to apply passage edits.');
        }

        return jsonResult({
          applied: !result.dryRun,
          dryRun: result.dryRun,
          warnings: result.warnings,
          passages: result.passages.map((passage) => ({
            uuid: passage.uuid,
            label: passage.label,
            sort: passage.sort,
            content: passage.content,
            annotations: passage.annotations.length,
          })),
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult(message);
      }
    },
  };
}
