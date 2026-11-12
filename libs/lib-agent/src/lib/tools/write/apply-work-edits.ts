import { z } from 'zod';
import type { DataClient, WorkEditOp } from '@eightyfourthousand/data-access';
import {
  applyWorkEdits,
  GLOSSARY_ATTESTATIONS,
  GLOSSARY_DEFINITION_RENDS,
  GLOSSARY_MODES,
  GLOSSARY_TERM_TYPES,
  hasPermission,
} from '@eightyfourthousand/data-access';
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

const glossaryNameFields = {
  language: z
    .string()
    .describe('Language code, e.g. en, Bo-Ltn, Sa-Ltn, Pi-Ltn, zh.'),
  content: z.string().describe('The name as written in that language.'),
  contentTransformed: z
    .string()
    .nullable()
    .optional()
    .describe('The Tibetan script, required for a new Bo-Ltn name.'),
  termType: z.enum(GLOSSARY_TERM_TYPES).nullable().optional(),
  attestation: z.enum(GLOSSARY_ATTESTATIONS).nullable().optional(),
};

const glossaryNameSchema = z.object({
  glossaryUuid: z
    .uuid()
    .optional()
    .describe(
      "The entry's row this name is. Omit to match by text: the first name to the root, the rest by language and content, then by language.",
    ),
  ...glossaryNameFields,
});

const glossaryNamesSchema = z
  .array(glossaryNameSchema)
  .describe(
    "The entry's whole name list after the op, the root (main) name first. Stored names not matched are removed; a name another entry or work shares is copied, never edited in place.",
  );

const glossaryValues = {
  definition: z
    .string()
    .nullable()
    .optional()
    .describe('The entry definition (HTML allowed).'),
  definitionRend: z.enum(GLOSSARY_DEFINITION_RENDS).nullable().optional(),
  glossMode: z.enum(GLOSSARY_MODES).nullable().optional(),
};

const glossaryExpectSchema = z
  .object({
    authority: z.uuid().optional(),
    definition: z.string().nullable().optional(),
    definitionRend: z.enum(GLOSSARY_DEFINITION_RENDS).nullable().optional(),
    glossMode: z.enum(GLOSSARY_MODES).nullable().optional(),
    names: z
      .array(z.object(glossaryNameFields))
      .optional()
      .describe(
        'Every stored name, in any order, each matched on the fields given.',
      ),
  })
  .describe(
    'Stored values of the entry as you last read them. The call is refused before anything is written if any differs.',
  );

const glossaryOpSchemas = [
  z.object({
    op: z.literal('upsert-glossary-entry'),
    entry: z.object({
      uuid: z
        .uuid()
        .optional()
        .describe(
          'Derived from the work, authority and root name when omitted, so a re-run updates the same entry.',
        ),
      authority: z
        .union([
          z.uuid(),
          z.object({
            new: z.object({
              headword: z.string(),
              headwordLanguage: z
                .string()
                .describe('Language of the headword, e.g. Sa-Ltn, Bo-Ltn, en.'),
              definition: z.string().nullable().optional(),
              uuid: z
                .uuid()
                .optional()
                .describe(
                  "Derived from the entry's uuid when omitted. Name it as another entry's authority to share it.",
                ),
            }),
          }),
        ])
        .describe(
          'An existing authority uuid, or { new: {...} } to create one with the entry (it gets the next entity-N xmlId; a re-run links to the one already created).',
        ),
      ...glossaryValues,
      names: glossaryNamesSchema,
    }),
    expect: glossaryExpectSchema.optional(),
  }),
  z.object({
    op: z.literal('patch-glossary-entry'),
    uuid: z.uuid(),
    set: z.object({ ...glossaryValues, names: glossaryNamesSchema.optional() }),
    expect: glossaryExpectSchema.describe(
      'A stored value for every field of set. The call is refused if any differs.',
    ),
  }),
  z.object({
    op: z.literal('relink-glossary-entry'),
    uuid: z.uuid(),
    authority: z
      .uuid()
      .describe('An existing authority, or one this call creates.'),
    expect: z.object({ authority: z.uuid() }),
  }),
  z.object({
    op: z.literal('delete-glossary-entry'),
    uuid: z.uuid(),
    expect: glossaryExpectSchema.optional(),
  }),
];

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
        'Patch for the work-level folio annotations. Only source_description is written; other keys are ignored with a warning. Updates existing rows only.',
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
  ...glossaryOpSchemas,
]);

const inputSchema = {
  workUuid: z.string().describe('UUID of the work being edited.'),
  ops: z
    .array(opSchema)
    .describe(
      'Ops to apply. update-work, upsert-title and upsert-folio-annotation edit the work metadata. upsert-passage writes whole passages, as an import does; delete-text, add-annotation, remove-annotation and insert-passage edit stored passages. Do not mix upsert-passage with the edit ops in one call. Edit offsets are read in the coordinates of the stored passage, before any edit in this list is applied. upsert-glossary-entry, patch-glossary-entry, relink-glossary-entry and delete-glossary-entry edit the work\u2019s glossary entries, one op per entry.',
    ),
  dryRun: z
    .boolean()
    .optional()
    .describe(
      'Plan every op against stored state and return the planned changes without writing. Use this to show the editor what would change.',
    ),
};

/**
 * Write tool that edits a work from one list of ops: its metadata, its
 * passages and its glossary entries. Requires `editor.edit`.
 */
export function createApplyWorkEditsTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'apply-work-edits',
    description:
      'Edit a work: its metadata (works row, titles, folio source description) and its passages, from one list of ops. Use it both to fill an empty work from an import and to edit a work that already has content. Ops fall into groups (work-metadata, then passages, then glossary); every op is planned against stored state before anything is written, and a refused op writes nothing. Groups then commit in that order, each on its own, and the first that fails stops the call: earlier groups stay written, later ones are listed in notAttempted. Passage edit ops and glossary ops are each all-or-nothing (glossary ops, including any authority an upsert creates, commit in one transaction); upsert-passage writes in chunks, and work-metadata table by table, so either can be partly written. A group whose applied is "unknown" may be partly written: re-read before issuing anything again, and never retry blindly. Send expect, or text on passage edits, with values you read so a stale read is refused. Run with dryRun first and show the editor the result before writing. Requires editor permissions.',
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
