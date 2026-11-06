/**
 * Acceptance tests for DEV-894 at the MCP tool boundary, written from TASK.md
 * and INTERFACE.md alone: the `apply-work-edits` tool and the two aliases
 * (`apply-entity-import`, `apply-passage-edits`) through `createWriteTools`,
 * with the real data layer over an in-memory fake client.
 *
 *  AC1  every skill flow works through apply-work-edits; old names still work
 *  AC2  a dry run of an import returns planned changes, writes nothing
 *  AC3  a later group fails: earlier applied, failing false/"unknown", rest
 *       notAttempted
 *
 * Permission goes through the real `hasPermission` (the fake answers the
 * `authorize` rpc), so no module mock is needed.
 */
import { z } from 'zod';
import { importPassageUuid } from '@eightyfourthousand/data-access';
import { createWriteTools } from './index';
import {
  CONTENT,
  OTHER_WORK,
  WORK,
  createFakeClient,
  editWorld,
  metadataWorld,
  snapshot,
  type FailureRule,
  type Row,
  type Tables,
} from './apply-work-edits.acceptance-fixture';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Group = any;

const call = async (
  name: string,
  args: Record<string, unknown>,
  {
    tables = metadataWorld(),
    allowed = true,
    failures,
  }: { tables?: Tables; allowed?: boolean; failures?: FailureRule[] } = {},
) => {
  const { client, world } = createFakeClient(tables, { allowed, failures });
  const tool = createWriteTools(client).find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  const result = await tool.handler(args as never, {} as never);
  const text = (result.content[0] as { text: string }).text;
  let payload: any;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = undefined;
  }
  return { result, text, payload, world, tables, tool };
};

const toolNamed = (name: string) => {
  const { client } = createFakeClient(metadataWorld());
  const tool = createWriteTools(client).find((t) => t.name === name);
  if (!tool) throw new Error(`no tool named ${name}`);
  return tool;
};

const derived = (n: number) => importPassageUuid(WORK, `docx-${n}`);
const row = (tables: Tables, table: string, uuid: string): Row | undefined =>
  (tables[table] ?? []).find((r) => r.uuid === uuid);
const group = (payload: any, name: string): Group =>
  payload.groups.find((g: Group) => g.group === name);

const TEXT_1 = 'Thus have I heard.';
const TEXT_2 = 'At one time the Blessed One dwelt.';

/** The import as the new tool takes it. */
const importOps = () => [
  { op: 'update-work', patch: { toh: 'toh44', restriction: true } },
  {
    op: 'upsert-title',
    title: { content: 'The Blessed One', type: 'mainTitle', language: 'en' },
  },
  {
    op: 'upsert-title',
    title: { content: 'Bhagavān', type: 'longTitle', language: 'Sa-Ltn' },
  },
  {
    op: 'upsert-folio-annotation',
    patch: { source_description: 'Degé Kangyur, volume 1' },
  },
  {
    op: 'upsert-passage',
    passage: { label: '1', type: 'translation', content: TEXT_1 },
    annotations: [{ kind: 'paragraph', start: 0, end: TEXT_1.length }],
  },
  {
    op: 'upsert-passage',
    passage: { label: '2', type: 'translation', content: TEXT_2 },
    annotations: [
      { kind: 'paragraph', start: 0, end: TEXT_2.length },
      { kind: 'span', start: 16, end: 27, data: { textStyle: 'emphasis' } },
    ],
  },
];

/** The same import as `apply-entity-import` takes it today. */
const legacyImportOperations = () => [
  { kind: 'update_work', patch: { toh: 'toh44', restriction: true } },
  {
    kind: 'upsert_title',
    title: { content: 'The Blessed One', type: 'mainTitle', language: 'en' },
  },
  {
    kind: 'upsert_title',
    title: { content: 'Bhagavān', type: 'longTitle', language: 'Sa-Ltn' },
  },
  {
    kind: 'upsert_passage',
    passage: { label: '1', type: 'translation', content: TEXT_1 },
    annotations: [{ kind: 'paragraph', start: 0, end: TEXT_1.length }],
  },
  {
    kind: 'upsert_passage',
    passage: { label: '2', type: 'translation', content: TEXT_2 },
    annotations: [
      { kind: 'paragraph', start: 0, end: TEXT_2.length },
      { kind: 'span', start: 16, end: 27, data: { textStyle: 'emphasis' } },
    ],
  },
];

const editOps = () => [
  {
    op: 'delete-text',
    passageUuid: 'p1',
    start: 14,
    end: 22,
    text: '[F.90.a]',
  },
  {
    op: 'add-annotation',
    passageUuid: 'p1',
    kind: 'span',
    start: 9,
    end: 13,
    text: 'lord',
    data: { textStyle: 'emphasis' },
  },
  { op: 'remove-annotation', passageUuid: 'p1', annotationUuid: 'a-note' },
  { op: 'insert-passage', before: 'p2', content: 'Inserted passage.' },
];

/** The same edits as `apply-passage-edits` takes them today. */
const legacyEdits = () => editOps();

const staleLeftover = (): Row => ({
  uuid: 'legacy-random-uuid',
  work_uuid: WORK,
  content: 'older import',
  label: '9',
  sort: 9,
  type: 'translation',
  xmlId: 'docx-9',
});

describe('write tools acceptance (DEV-894)', () => {
  describe('registration', () => {
    it('[AC1] createWriteTools returns apply-work-edits and keeps both old names registered', () => {
      const { client } = createFakeClient(metadataWorld());
      const names = createWriteTools(client).map((t) => t.name);

      expect(names).toEqual(
        expect.arrayContaining([
          'apply-work-edits',
          'apply-entity-import',
          'apply-passage-edits',
        ]),
      );
      expect(new Set(names).size).toBe(names.length);
    });

    it('[AC1] apply-work-edits is a write tool: not read-only, destructive', () => {
      const tool = toolNamed('apply-work-edits');

      expect(tool.name).toBe('apply-work-edits');
      expect(tool.annotations?.readOnlyHint).toBe(false);
      expect(tool.annotations?.destructiveHint).toBe(true);
    });

    it('[AC1] apply-work-edits takes workUuid, ops (kebab-case op) and an optional dryRun', () => {
      const tool = toolNamed('apply-work-edits');
      const schema = z.object(tool.inputSchema as z.ZodRawShape);

      expect(
        schema.safeParse({
          workUuid: WORK,
          ops: [...importOps(), ...editOps()],
        }).success,
      ).toBe(true);
      expect(
        schema.safeParse({ workUuid: WORK, ops: importOps(), dryRun: true })
          .success,
      ).toBe(true);
      expect(schema.safeParse({ ops: importOps() }).success).toBe(false);
      expect(schema.safeParse({ workUuid: WORK }).success).toBe(false);
      // The snake_case kinds belong to the alias, not to the new tool.
      expect(
        schema.safeParse({
          workUuid: WORK,
          ops: [{ kind: 'update_work', patch: {} }],
        }).success,
      ).toBe(false);
    });
  });

  describe('apply-work-edits', () => {
    it('[AC1] an import goes through the tool and commits both groups', async () => {
      const { result, payload, tables } = await call('apply-work-edits', {
        workUuid: WORK,
        ops: importOps(),
      });

      expect(result.isError).toBeFalsy();
      expect(payload).toMatchObject({
        success: true,
        dryRun: false,
        notAttempted: [],
      });
      expect(payload.groups.map((g: Group) => g.group)).toEqual([
        'work-metadata',
        'passages',
      ]);
      expect(payload.groups.map((g: Group) => g.applied)).toEqual([true, true]);
      expect(row(tables, 'works', WORK)).toMatchObject({
        toh: 'toh44',
        restriction: true,
      });
      expect(row(tables, 'titles', 't-en-main')?.content).toBe(
        'The Blessed One',
      );
      expect(row(tables, 'folio_annotations', 'fa-work')).toMatchObject({
        source_description: 'Degé Kangyur, volume 1',
      });
      expect(row(tables, 'passages', derived(0))?.content).toBe(TEXT_1);
      expect(row(tables, 'passages', derived(1))?.content).toBe(TEXT_2);
      expect(tables.passage_annotations).toHaveLength(3);
    });

    it('[AC1] a passage edit flow goes through the tool', async () => {
      const { result, payload, tables } = await call(
        'apply-work-edits',
        { workUuid: WORK, ops: editOps() },
        { tables: editWorld() },
      );

      expect(result.isError).toBeFalsy();
      expect(payload.success).toBe(true);
      expect(payload.groups.map((g: Group) => g.group)).toEqual(['passages']);
      expect(payload.groups[0].applied).toBe(true);
      expect(row(tables, 'passages', 'p1')?.content).toBe(
        'Then the lord  said this',
      );
      expect(row(tables, 'passage_annotations', 'a-note')).toBeUndefined();
      expect(
        tables.passages.some((p) => p.content === 'Inserted passage.'),
      ).toBe(true);
    });

    it('[AC1] the result is the ApplyWorkEditsResult as JSON text', async () => {
      const { result, payload } = await call('apply-work-edits', {
        workUuid: WORK,
        ops: importOps(),
        dryRun: true,
      });

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toMatchObject({ type: 'text' });
      expect(Object.keys(payload).sort()).toEqual(
        expect.arrayContaining(['dryRun', 'groups', 'notAttempted', 'success']),
      );
    });

    it('[AC2] a dry run of an import returns the planned changes and writes nothing', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      const { result, payload, world } = await call(
        'apply-work-edits',
        { workUuid: WORK, ops: importOps(), dryRun: true },
        { tables },
      );

      expect(result.isError).toBeFalsy();
      expect(payload).toMatchObject({
        success: true,
        dryRun: true,
        notAttempted: [],
      });
      expect(payload.groups.map((g: Group) => g.applied)).toEqual([
        false,
        false,
      ]);

      const metadata = group(payload, 'work-metadata').changes;
      expect(metadata.work.fields.toh).toEqual({ from: 'toh1', to: 'toh44' });
      expect(metadata.titles).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'update',
            content: 'The Blessed One',
            previous: 'Old Title',
          }),
          expect.objectContaining({
            action: 'insert',
            content: 'Bhagavān',
            language: 'Sa-Ltn',
          }),
        ]),
      );
      expect(metadata.folioAnnotation).toMatchObject({ rows: 1 });
      expect(group(payload, 'passages').changes.passages).toEqual([
        expect.objectContaining({ action: 'insert', label: '1', sort: 0 }),
        expect.objectContaining({ action: 'insert', label: '2', sort: 1 }),
      ]);

      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC2] a dry run of an edit flow writes nothing', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { payload, world } = await call(
        'apply-work-edits',
        { workUuid: WORK, ops: editOps(), dryRun: true },
        { tables },
      );

      expect(payload.success).toBe(true);
      expect(payload.dryRun).toBe(true);
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC3] a later group that fails: the tool reports isError with each group state in the JSON body', async () => {
      const tables = editWorld();
      const { result, payload } = await call(
        'apply-work-edits',
        {
          workUuid: WORK,
          ops: [{ op: 'update-work', patch: { toh: 'toh44' } }, ...editOps()],
        },
        {
          tables,
          failures: [{ target: 'apply_passage_save', mode: 'rolled-back' }],
        },
      );

      expect(result.isError).toBe(true);
      expect(payload.success).toBe(false);
      expect(group(payload, 'work-metadata').applied).toBe(true);
      expect(group(payload, 'passages').applied).toBe(false);
      expect(payload.notAttempted).toEqual([]);
      expect(row(tables, 'works', WORK)?.toh).toBe('toh44');
      expect(row(tables, 'passages', 'p1')?.content).toBe(CONTENT);
    });

    it('[AC3] a lost response in the later group is reported as "unknown"', async () => {
      const { result, payload } = await call(
        'apply-work-edits',
        {
          workUuid: WORK,
          ops: [{ op: 'update-work', patch: { toh: 'toh44' } }, ...editOps()],
        },
        {
          tables: editWorld(),
          failures: [{ target: 'apply_passage_save', mode: 'lost-response' }],
        },
      );

      expect(result.isError).toBe(true);
      expect(group(payload, 'work-metadata').applied).toBe(true);
      expect(group(payload, 'passages').applied).toBe('unknown');
    });

    it('[AC3] work-metadata failing on commit leaves passages notAttempted, and the body still says so', async () => {
      const tables = metadataWorld();
      const { result, payload, world } = await call(
        'apply-work-edits',
        { workUuid: WORK, ops: importOps() },
        { tables, failures: [{ target: 'works', mode: 'rolled-back' }] },
      );

      expect(result.isError).toBe(true);
      expect(payload.success).toBe(false);
      expect([false, 'unknown']).toContain(
        group(payload, 'work-metadata').applied,
      );
      expect(payload.notAttempted).toEqual(['passages']);
      expect(tables.passages).toEqual([]);
      expect(
        world.writes.filter((w) => w.target === 'apply_passage_save'),
      ).toEqual([]);
    });

    it('[AC3] a planning failure (failed expect) is isError with nothing written', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      const { result, payload, world } = await call(
        'apply-work-edits',
        {
          workUuid: WORK,
          ops: [
            {
              op: 'update-work',
              patch: { toh: 'toh44' },
              expect: { toh: 'toh99' },
            },
            ...importOps().slice(4),
          ],
        },
        { tables },
      );

      expect(result.isError).toBe(true);
      expect(payload.success).toBe(false);
      expect(payload.error).toContain('toh');
      expect(payload.notAttempted).toEqual(['passages']);
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC3] a planning failure (failed text guard) is isError with nothing written', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, payload, world } = await call(
        'apply-work-edits',
        {
          workUuid: WORK,
          ops: [
            { op: 'update-work', patch: { toh: 'toh44' } },
            {
              op: 'delete-text',
              passageUuid: 'p1',
              start: 14,
              end: 22,
              text: '[F.91.a]',
            },
          ],
        },
        { tables },
      );

      expect(result.isError).toBe(true);
      expect(payload.success).toBe(false);
      expect(payload.notAttempted).toEqual(['work-metadata']);
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[CONV] success is not an error: isError is not set when success is true', async () => {
      const { result, payload } = await call('apply-work-edits', {
        workUuid: WORK,
        ops: [{ op: 'update-work', patch: { toh: 'toh44' } }],
      });

      expect(payload.success).toBe(true);
      expect(result.isError).toBeFalsy();
    });

    it('[CONV] upsert-passage mixed with an edit op is refused with isError and nothing written', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, payload, world } = await call(
        'apply-work-edits',
        { workUuid: WORK, ops: [importOps()[4], editOps()[0]] },
        { tables },
      );

      expect(result.isError).toBe(true);
      expect(payload.success).toBe(false);
      expect(payload.error).toEqual(expect.any(String));
      expect(payload.notAttempted).toContain('passages');
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[CONV] an expect mismatch names the field and writes nothing', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      const { result, payload, world } = await call(
        'apply-work-edits',
        {
          workUuid: WORK,
          ops: [
            {
              op: 'upsert-title',
              title: { content: 'X', type: 'mainTitle', language: 'en' },
              expect: { content: 'Not the stored title' },
            },
          ],
        },
        { tables },
      );

      expect(result.isError).toBe(true);
      expect(payload.error).toContain('content');
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[CONV] without editor.edit the tool returns an error and neither reads nor writes', async () => {
      for (const [name, args] of [
        ['apply-work-edits', { workUuid: WORK, ops: importOps() }],
        [
          'apply-work-edits',
          { workUuid: WORK, ops: importOps(), dryRun: true },
        ],
      ] as const) {
        const tables = metadataWorld();
        const before = snapshot(tables);

        const { result, text, world } = await call(name, args as never, {
          tables,
          allowed: false,
        });

        expect(result.isError).toBe(true);
        expect(text.length).toBeGreaterThan(0);
        expect(world.writes).toEqual([]);
        // Only the permission check ran: no table was read.
        expect(world.calls).toEqual(['rpc:authorize']);
        expect(snapshot(tables)).toEqual(before);
      }
    });
  });

  describe('apply-entity-import alias', () => {
    it('[AC1] keeps its name, its snake_case input schema and its metadata', () => {
      const tool = toolNamed('apply-entity-import');
      const schema = z.object(tool.inputSchema as z.ZodRawShape);

      expect(tool.name).toBe('apply-entity-import');
      expect(tool.annotations?.readOnlyHint).toBe(false);
      expect(
        schema.safeParse({
          workUuid: WORK,
          operations: legacyImportOperations(),
        }).success,
      ).toBe(true);
      expect(
        schema.safeParse({
          workUuid: WORK,
          operations: [
            {
              kind: 'upsert_folio_annotation',
              patch: { source_description: 'x' },
            },
          ],
        }).success,
      ).toBe(true);
      // Its input is `operations` with `kind`, not the new tool's `ops`/`op`.
      expect(
        schema.safeParse({ workUuid: WORK, ops: importOps() }).success,
      ).toBe(false);
      expect(
        schema.safeParse({
          workUuid: WORK,
          operations: [{ op: 'update-work', patch: {} }],
        }).success,
      ).toBe(false);
    });

    it('[AC1] an import returns { applied: true, counts, warnings } and writes the rows', async () => {
      const { result, payload, tables } = await call('apply-entity-import', {
        workUuid: WORK,
        operations: legacyImportOperations(),
      });

      expect(result.isError).toBeFalsy();
      expect(Object.keys(payload).sort()).toEqual([
        'applied',
        'counts',
        'warnings',
      ]);
      expect(payload.applied).toBe(true);
      expect(payload.counts).toEqual({
        workUpdates: 1,
        titles: 1,
        titlesUpdated: 1,
        folioUpdates: 0,
        passages: 2,
        annotations: 3,
      });
      expect(payload.warnings).toEqual([]);

      expect(row(tables, 'works', WORK)).toMatchObject({
        toh: 'toh44',
        restriction: true,
      });
      expect(row(tables, 'works', OTHER_WORK)?.toh).toBe('toh2');
      expect(row(tables, 'titles', 't-en-main')?.content).toBe(
        'The Blessed One',
      );
      expect(row(tables, 'passages', derived(0))?.content).toBe(TEXT_1);
      expect(row(tables, 'passages', derived(1))?.content).toBe(TEXT_2);
      expect(tables.passage_annotations).toHaveLength(3);
    });

    it('[AC1] re-running the same import is safe and counts titles as updates', async () => {
      const tables = metadataWorld();
      await call(
        'apply-entity-import',
        { workUuid: WORK, operations: legacyImportOperations() },
        { tables },
      );
      const afterFirst = snapshot(tables);

      const { payload } = await call(
        'apply-entity-import',
        { workUuid: WORK, operations: legacyImportOperations() },
        { tables },
      );

      expect(payload.applied).toBe(true);
      expect(payload.counts).toEqual({
        workUpdates: 1,
        titles: 0,
        titlesUpdated: 2,
        folioUpdates: 0,
        passages: 2,
        annotations: 3,
      });
      expect(snapshot(tables)).toEqual(afterFirst);
    });

    it('[AC1] a passages-only import reports zero for the groups it did not touch', async () => {
      const { payload } = await call('apply-entity-import', {
        workUuid: WORK,
        operations: legacyImportOperations().slice(3),
      });

      expect(payload.counts).toEqual({
        workUpdates: 0,
        titles: 0,
        titlesUpdated: 0,
        folioUpdates: 0,
        passages: 2,
        annotations: 3,
      });
    });

    it('[AC1] upsert_folio_annotation now updates source_description, and folioUpdates counts the rows (behaviour change per INTERFACE.md)', async () => {
      const tables = metadataWorld();
      const { result, payload } = await call(
        'apply-entity-import',
        {
          workUuid: WORK,
          operations: [
            {
              kind: 'upsert_folio_annotation',
              patch: { source_description: 'Degé Kangyur, volume 1' },
            },
          ],
        },
        { tables },
      );

      expect(result.isError).toBeFalsy();
      expect(payload.applied).toBe(true);
      expect(payload.counts.folioUpdates).toBe(1);
      expect(row(tables, 'folio_annotations', 'fa-work')).toMatchObject({
        source_description: 'Degé Kangyur, volume 1',
      });
      // Only this work's work-type rows.
      expect(
        row(tables, 'folio_annotations', 'fa-folio')?.source_description,
      ).toBe('folio row, not to be touched');
      expect(
        row(tables, 'folio_annotations', 'fa-other')?.source_description,
      ).toBe('other work description');
    });

    it('[AC1] a stored import passage the new import no longer has is left in place, as a string warning', async () => {
      const tables = metadataWorld();
      tables.passages = [
        {
          uuid: derived(7),
          work_uuid: WORK,
          content: 'dropped from the new import',
          label: '8',
          sort: 7,
          type: 'translation',
          xmlId: 'docx-7',
        },
      ];

      const { result, payload } = await call(
        'apply-entity-import',
        { workUuid: WORK, operations: legacyImportOperations().slice(3) },
        { tables },
      );

      expect(result.isError).toBeFalsy();
      expect(payload.warnings).toHaveLength(1);
      expect(typeof payload.warnings[0]).toBe('string');
      expect(row(tables, 'passages', derived(7))).toBeDefined();
    });

    it('[AC1] a failure is an error result whose text is the failure message, with nothing written', async () => {
      const tables = metadataWorld();
      tables.passages = [staleLeftover()];
      const before = snapshot(tables);

      const { result, text, payload, world } = await call(
        'apply-entity-import',
        { workUuid: WORK, operations: legacyImportOperations() },
        { tables },
      );

      expect(result.isError).toBe(true);
      expect(text).toContain('Nothing was saved');
      // A message, not the new tool's JSON body.
      expect(payload).toBeUndefined();
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC1] a commit that fails is an error result with the message', async () => {
      const { result, text } = await call(
        'apply-entity-import',
        { workUuid: WORK, operations: legacyImportOperations() },
        {
          failures: [{ target: 'apply_passage_save', mode: 'rolled-back' }],
        },
      );

      expect(result.isError).toBe(true);
      expect(text.length).toBeGreaterThan(0);
    });

    it('[CONV] without editor.edit it returns an error and neither reads nor writes', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      const { result, world } = await call(
        'apply-entity-import',
        { workUuid: WORK, operations: legacyImportOperations() },
        { tables, allowed: false },
      );

      expect(result.isError).toBe(true);
      expect(world.writes).toEqual([]);
      expect(world.calls).toEqual(['rpc:authorize']);
      expect(snapshot(tables)).toEqual(before);
    });
  });

  describe('apply-passage-edits alias', () => {
    it('[AC1] keeps its name, its input schema and its metadata', () => {
      const tool = toolNamed('apply-passage-edits');
      const schema = z.object(tool.inputSchema as z.ZodRawShape);
      const [cut, add] = legacyEdits();

      expect(tool.name).toBe('apply-passage-edits');
      expect(tool.annotations?.readOnlyHint).toBe(false);
      expect(tool.annotations?.destructiveHint).toBe(true);
      expect(
        schema.safeParse({ workUuid: WORK, edits: legacyEdits() }).success,
      ).toBe(true);
      expect(
        schema.safeParse({ workUuid: WORK, edits: [cut], dryRun: true })
          .success,
      ).toBe(true);
      // text is required for a cut and optional for an add.
      const { text: _text, ...withoutText } = cut as Record<string, unknown>;
      expect(
        schema.safeParse({ workUuid: WORK, edits: [withoutText] }).success,
      ).toBe(false);
      const { text: _addText, ...addWithoutText } = add as Record<
        string,
        unknown
      >;
      expect(
        schema.safeParse({ workUuid: WORK, edits: [addWithoutText] }).success,
      ).toBe(true);
      // Its input is `edits`, not the new tool's `ops`.
      expect(
        schema.safeParse({ workUuid: WORK, ops: legacyEdits() }).success,
      ).toBe(false);
    });

    it('[AC1] an edit flow returns { applied, dryRun, warnings, passages } with the passages summarised', async () => {
      const tables = editWorld();
      const { result, payload } = await call(
        'apply-passage-edits',
        { workUuid: WORK, edits: legacyEdits() },
        { tables },
      );

      expect(result.isError).toBeFalsy();
      expect(Object.keys(payload).sort()).toEqual([
        'applied',
        'dryRun',
        'passages',
        'warnings',
      ]);
      expect(payload).toMatchObject({
        applied: true,
        dryRun: false,
        warnings: [],
      });
      const p1 = payload.passages.find((p: Row) => p.uuid === 'p1');
      expect(p1).toEqual({
        uuid: 'p1',
        label: '1.10',
        sort: 548,
        content: 'Then the lord  said this',
        annotations: 2,
      });
      const inserted = payload.passages.find(
        (p: Row) => p.content === 'Inserted passage.',
      );
      expect(Object.keys(inserted).sort()).toEqual([
        'annotations',
        'content',
        'label',
        'sort',
        'uuid',
      ]);
      expect(inserted).toMatchObject({ label: '', annotations: 0 });

      expect(row(tables, 'passages', 'p1')?.content).toBe(
        'Then the lord  said this',
      );
      expect(row(tables, 'passage_annotations', 'a-note')).toBeUndefined();
      expect(
        tables.passages.some((p) => p.content === 'Inserted passage.'),
      ).toBe(true);
    });

    it('[AC1] a dry run reports applied false and writes nothing', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, payload, world } = await call(
        'apply-passage-edits',
        { workUuid: WORK, edits: legacyEdits(), dryRun: true },
        { tables },
      );

      expect(result.isError).toBeFalsy();
      expect(payload).toMatchObject({ applied: false, dryRun: true });
      expect(payload.passages.find((p: Row) => p.uuid === 'p1').content).toBe(
        'Then the lord  said this',
      );
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC1] the warnings an edit produced are returned as { message, passageUuid? }', async () => {
      const { payload } = await call(
        'apply-passage-edits',
        {
          workUuid: WORK,
          edits: [
            {
              op: 'remove-annotation',
              passageUuid: 'p1',
              annotationUuid: 'nope',
            },
          ],
        },
        { tables: editWorld() },
      );

      expect(payload.applied).toBe(true);
      expect(payload.warnings).toEqual([
        expect.objectContaining({
          passageUuid: 'p1',
          message: expect.stringContaining('nope'),
        }),
      ]);
    });

    it('[AC1] a failure is an error result: the error, then each warning message on its own line', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, text, world } = await call(
        'apply-passage-edits',
        {
          workUuid: WORK,
          edits: [
            {
              op: 'remove-annotation',
              passageUuid: 'p1',
              annotationUuid: 'nope',
            },
            {
              op: 'add-annotation',
              passageUuid: 'p1',
              kind: 'no-such-kind',
              start: 0,
              end: 4,
            },
          ],
        },
        { tables },
      );

      expect(result.isError).toBe(true);
      const lines = text.split('\n');
      expect(lines).toHaveLength(2);
      expect(lines[0]).toContain('no-such-kind');
      expect(lines[1]).toContain('nope');
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC1] a text guard that does not match is an error result naming what was expected', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, text, world } = await call(
        'apply-passage-edits',
        {
          workUuid: WORK,
          edits: [{ ...legacyEdits()[0], text: '[F.91.a]' }],
        },
        { tables },
      );

      expect(result.isError).toBe(true);
      expect(text).toContain('[F.91.a]');
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC1] a passage that is not in the work is an error result naming it', async () => {
      const { result, text } = await call(
        'apply-passage-edits',
        {
          workUuid: WORK,
          edits: [
            {
              op: 'remove-annotation',
              passageUuid: 'p-missing',
              annotationUuid: 'x',
            },
          ],
        },
        { tables: editWorld() },
      );

      expect(result.isError).toBe(true);
      expect(text).toContain('p-missing');
    });

    it('[AC1] a save whose response was lost is an error result starting applied: "unknown".', async () => {
      const { result, text } = await call(
        'apply-passage-edits',
        { workUuid: WORK, edits: legacyEdits() },
        {
          tables: editWorld(),
          failures: [{ target: 'apply_passage_save', mode: 'lost-response' }],
        },
      );

      expect(result.isError).toBe(true);
      expect(text.startsWith('applied: "unknown".')).toBe(true);
    });

    it('[AC1] a save Postgres rolled back is an error result that is not "unknown"', async () => {
      const { result, text } = await call(
        'apply-passage-edits',
        { workUuid: WORK, edits: legacyEdits() },
        {
          tables: editWorld(),
          failures: [{ target: 'apply_passage_save', mode: 'rolled-back' }],
        },
      );

      expect(result.isError).toBe(true);
      expect(text.startsWith('applied: "unknown"')).toBe(false);
    });

    it('[CONV] without editor.edit it returns an error and neither reads nor writes', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, world } = await call(
        'apply-passage-edits',
        { workUuid: WORK, edits: legacyEdits() },
        { tables, allowed: false },
      );

      expect(result.isError).toBe(true);
      expect(world.writes).toEqual([]);
      expect(world.calls).toEqual(['rpc:authorize']);
      expect(snapshot(tables)).toEqual(before);
    });
  });
});
