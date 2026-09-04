import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  applyImportPreview,
  hasPermission,
  type ImportOperationInput,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { jsonResult, errorResult } from '../read/util';

const annotationSchema = z.object({
  kind: z
    .string()
    .describe(
      'Annotation kind: blockquote, paragraph, indent, line-group, line, span, link, or heading.',
    ),
  start: z
    .number()
    .int()
    .describe('Inclusive character offset within the passage content.'),
  end: z
    .number()
    .int()
    .describe('Exclusive character offset within the passage content.'),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      'Kind-specific attributes, e.g. { "textStyle": "emphasis" } for span, { "href": "..." } for link, { "level": 2, "class": "section-title" } for heading.',
    ),
});

const operationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('update_work'),
    patch: z
      .record(z.string(), z.unknown())
      .describe(
        'Partial works-row patch, e.g. { "toh": "toh44" } or { "restriction": true }.',
      ),
  }),
  z.object({
    kind: z.literal('upsert_title'),
    title: z.object({
      content: z.string().describe('Title text.'),
      type: z
        .string()
        .describe('Title type: mainTitle, longTitle, or otherTitle.'),
      language: z
        .string()
        .optional()
        .describe('BCP-style language code, e.g. bo, Bo-Ltn, en, Sa-Ltn, zh.'),
      uuid: z.string().optional().describe('Optional; generated when omitted.'),
    }),
  }),
  z.object({
    kind: z.literal('upsert_folio_annotation'),
    patch: z
      .record(z.string(), z.unknown())
      .describe(
        'Folio annotation patch, e.g. { "source_description": "..." }.',
      ),
  }),
  z.object({
    kind: z.literal('upsert_passage'),
    passage: z.object({
      label: z
        .string()
        .describe('Passage label, e.g. "s.", "i.", "1", "1.1", or "".'),
      type: z
        .string()
        .describe(
          'Passage type, e.g. summaryHeader, summary, translationHeader, translation, colophon.',
        ),
      content: z.string().describe('Plain text passage content.'),
      sort: z
        .number()
        .int()
        .optional()
        .describe('Optional; assigned in source order when omitted.'),
      uuid: z.string().optional().describe('Optional; generated when omitted.'),
      xmlId: z.string().optional().describe('Optional source identifier.'),
    }),
    annotations: z
      .array(annotationSchema)
      .optional()
      .describe('Annotations scoped to this passage.'),
  }),
]);

const inputSchema = {
  workUuid: z
    .string()
    .describe(
      'UUID of the target work. The work must have no titles or passages yet.',
    ),
  operations: z
    .array(operationSchema)
    .describe(
      'Ordered import operations produced by mapping the docx: update_work, upsert_title, upsert_folio_annotation, and upsert_passage.',
    ),
};

/**
 * Write tool that applies entity import operations to target work. Titles, work
 * metadata, folio source description, and passages (with their annotations) are
 * written through the shared passage save path. Requires `editor.edit` permission.
 */
export function createApplyImportTool(client: DataClient): McpToolDefinition {
  return {
    name: 'apply-entity-import',
    description:
      'Persist work entities (titles, metadata, and passages with annotations) into a target work. Present the operations to the user for review before calling this. Requires editor permissions.',
    inputSchema,
    annotations: {
      title: 'Apply Enity Import',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: async ({ workUuid, operations }) => {
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
        const result = await applyImportPreview({
          client,
          workUuid,
          operations: operations as ImportOperationInput[],
        });
        return jsonResult({ applied: true, ...result });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return errorResult(message);
      }
    },
  };
}
