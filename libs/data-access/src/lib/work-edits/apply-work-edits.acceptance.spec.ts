/**
 * Acceptance tests for DEV-894, `applyWorkEdits`, written from TASK.md and
 * INTERFACE.md alone. Each test names the criterion it covers:
 *
 *  AC1  every existing skill flow works through apply-work-edits
 *  AC2  a dry run of an import returns the planned changes, writes nothing
 *  AC3  a mixed call where a later group fails: earlier applied, failing
 *       false / "unknown", the rest notAttempted
 *  CONV conventions: expect and text guards, group order, mixing refusal
 */
import { applyWorkEdits } from '../../index';
import { importPassageUuid } from '../passage/derived-uuids';
import {
  CONTENT,
  WORK,
  OTHER_WORK,
  createFakeClient,
  editWorld,
  metadataWorld,
  snapshot,
  type FailureRule,
  type Row,
  type Tables,
} from './apply-work-edits.acceptance-fixture';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Result = any;
type Group = any;

const run = async (
  tables: Tables,
  ops: unknown[],
  { dryRun, failures }: { dryRun?: boolean; failures?: FailureRule[] } = {},
) => {
  const { client, world } = createFakeClient(tables, { failures });
  const result: Result = await applyWorkEdits({
    client,
    workUuid: WORK,
    ops: ops as never,
    ...(dryRun === undefined ? {} : { dryRun }),
  });
  return { result, world, tables };
};

const group = (result: Result, name: string): Group | undefined =>
  result.groups.find((g: Group) => g.group === name);

const derived = (n: number) => importPassageUuid(WORK, `docx-${n}`);

const TEXT_1 = 'Thus have I heard.';
const TEXT_2 = 'At one time the Blessed One dwelt.';

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

const row = (tables: Tables, table: string, uuid: string): Row | undefined =>
  (tables[table] ?? []).find((r) => r.uuid === uuid);

const workRow = (tables: Tables) => row(tables, 'works', WORK) as Row;

const passagesOf = (tables: Tables) =>
  tables.passages.filter((p) => p.work_uuid === WORK);

describe('applyWorkEdits acceptance (DEV-894)', () => {
  describe('AC1: every skill flow works through apply-work-edits', () => {
    it('[AC1] an import (update-work, upsert-title, upsert-folio-annotation, upsert-passage) commits both groups in order', async () => {
      const tables = metadataWorld();
      const { result } = await run(tables, importOps());

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(false);
      expect(result.error).toBeUndefined();
      expect(result.notAttempted).toEqual([]);
      expect(result.groups.map((g: Group) => g.group)).toEqual([
        'work-metadata',
        'passages',
      ]);
      expect(result.groups.map((g: Group) => g.applied)).toEqual([true, true]);
      expect(result.groups.map((g: Group) => g.ops)).toEqual([4, 2]);

      // works: patched, other fields and other works untouched
      expect(workRow(tables)).toMatchObject({
        toh: 'toh44',
        restriction: true,
        meta: { a: [1, 2] },
      });
      expect(row(tables, 'works', OTHER_WORK)).toMatchObject({ toh: 'toh2' });

      // titles: filled slot updated in place, new slot inserted
      expect(row(tables, 'titles', 't-en-main')).toMatchObject({
        content: 'The Blessed One',
      });
      const inserted = tables.titles.find(
        (t) => t.type === 'longTitle' && t.language === 'Sa-Ltn',
      );
      expect(inserted).toMatchObject({
        work_uuid: WORK,
        content: 'Bhagavān',
      });
      expect(tables.titles.filter((t) => t.work_uuid === WORK)).toHaveLength(3);
      expect(row(tables, 'titles', 't-other')).toMatchObject({
        content: 'Other Work Title',
      });

      // folio annotation: only this work's 'work' rows
      expect(row(tables, 'folio_annotations', 'fa-work')).toMatchObject({
        source_description: 'Degé Kangyur, volume 1',
      });
      expect(row(tables, 'folio_annotations', 'fa-folio')).toMatchObject({
        source_description: 'folio row, not to be touched',
      });
      expect(row(tables, 'folio_annotations', 'fa-other')).toMatchObject({
        source_description: 'other work description',
      });

      // passages: derived uuids, source-order sorts, annotations saved
      const passages = passagesOf(tables).sort(
        (a, b) => (a.sort as number) - (b.sort as number),
      );
      expect(passages.map((p) => p.uuid)).toEqual([derived(0), derived(1)]);
      expect(passages.map((p) => p.content)).toEqual([TEXT_1, TEXT_2]);
      expect(passages.map((p) => p.label)).toEqual(['1', '2']);
      expect(passages.map((p) => p.sort)).toEqual([0, 1]);
      expect(tables.passage_annotations).toHaveLength(3);
      expect(
        tables.passage_annotations.filter((a) => a.passage_uuid === derived(1)),
      ).toHaveLength(2);
    });

    it('[AC1] a committed import reports what it wrote', async () => {
      const { result } = await run(metadataWorld(), importOps());

      const metadata = group(result, 'work-metadata').changes;
      expect(metadata.group).toBe('work-metadata');
      expect(metadata.work.fields.toh).toEqual({ from: 'toh1', to: 'toh44' });
      expect(metadata.titles).toHaveLength(2);
      expect(metadata.folioAnnotation).toMatchObject({ rows: 1 });

      const passages = group(result, 'passages').changes;
      expect(passages.group).toBe('passages');
      expect(passages.passages).toHaveLength(2);
    });

    it('[AC1] re-running the same import is safe: the second run changes nothing', async () => {
      const tables = metadataWorld();
      await run(tables, importOps());
      const afterFirst = snapshot(tables);

      const { result } = await run(tables, importOps());

      expect(result.success).toBe(true);
      expect(snapshot(tables)).toEqual(afterFirst);
    });

    it('[AC1] a passage edit flow (delete-text, add-annotation with text guard, remove-annotation, insert-passage) commits', async () => {
      const tables = editWorld();
      const { result } = await run(tables, editOps());

      expect(result.success).toBe(true);
      expect(result.notAttempted).toEqual([]);
      // A group with no ops is skipped and not listed.
      expect(result.groups.map((g: Group) => g.group)).toEqual(['passages']);
      expect(group(result, 'passages')).toMatchObject({
        applied: true,
        ops: 4,
      });

      expect(row(tables, 'passages', 'p1')?.content).toBe(
        'Then the lord  said this',
      );
      const annotations = tables.passage_annotations.filter(
        (a) => a.passage_uuid === 'p1',
      );
      expect(annotations.map((a) => a.uuid)).not.toContain('a-note');
      expect(annotations.map((a) => a.uuid)).toContain('a-span');
      const added = annotations.find((a) => a.uuid !== 'a-span');
      expect(added).toMatchObject({ type: 'span', start: 9, end: 13 });

      const inserted = passagesOf(tables).find(
        (p) => p.content === 'Inserted passage.',
      ) as Row;
      expect(inserted).toBeDefined();
      expect(inserted.sort as number).toBeGreaterThan(
        row(tables, 'passages', 'p1')?.sort as number,
      );
      expect(inserted.sort as number).toBeLessThan(
        row(tables, 'passages', 'p2')?.sort as number,
      );
    });

    it('[AC1] an edit flow reports each passage it changed, with the content after the edit', async () => {
      const { result } = await run(editWorld(), editOps());

      const { passages } = group(result, 'passages').changes;
      const p1 = passages.find((p: Row) => p.uuid === 'p1');
      expect(p1).toMatchObject({
        label: '1.10',
        sort: 548,
        action: 'update',
        content: 'Then the lord  said this',
        annotations: 2,
      });
      const inserted = passages.find(
        (p: Row) => p.content === 'Inserted passage.',
      );
      expect(inserted).toMatchObject({ action: 'insert', annotations: 0 });
    });

    it('[AC1] several update-work ops merge in list order', async () => {
      const tables = metadataWorld();
      const { result } = await run(tables, [
        { op: 'update-work', patch: { toh: 'toh-first', restriction: true } },
        { op: 'update-work', patch: { toh: 'toh-second' } },
      ]);

      expect(result.success).toBe(true);
      expect(workRow(tables)).toMatchObject({
        toh: 'toh-second',
        restriction: true,
      });
      expect(row(tables, 'works', OTHER_WORK)).toMatchObject({ toh: 'toh2' });
    });

    it('[AC1] a title is upserted by slot: (type, language) when a language is given, else (type, content)', async () => {
      const tables = metadataWorld();
      const titlesOfWork = () =>
        tables.titles.filter((t) => t.work_uuid === WORK);

      // Filled (mainTitle, en) slot: updated in place.
      await run(tables, [
        {
          op: 'upsert-title',
          title: { content: 'Renamed', type: 'mainTitle', language: 'en' },
        },
      ]);
      expect(titlesOfWork()).toHaveLength(2);
      expect(row(tables, 'titles', 't-en-main')?.content).toBe('Renamed');

      // No language: slot is (type, content), so a new content is inserted...
      await run(tables, [
        { op: 'upsert-title', title: { content: 'Alt', type: 'otherTitle' } },
      ]);
      expect(titlesOfWork()).toHaveLength(3);
      // ...and the same content again is a no-op, not a duplicate.
      const { result } = await run(tables, [
        { op: 'upsert-title', title: { content: 'Alt', type: 'otherTitle' } },
      ]);
      expect(result.success).toBe(true);
      expect(titlesOfWork()).toHaveLength(3);
    });

    it("[AC1] upsert-folio-annotation updates only this work's work-type rows, and only source_description", async () => {
      const tables = metadataWorld();
      await run(tables, [
        {
          op: 'upsert-folio-annotation',
          patch: { source_description: 'new', unrelated_column: 'x' },
        },
      ]);

      const stored = row(tables, 'folio_annotations', 'fa-work') as Row;
      expect(stored.source_description).toBe('new');
      // Whatever the op does with a patch beyond source_description
      // (refuse it, or ignore the extra key), it never writes the other key.
      expect(stored).not.toHaveProperty('unrelated_column');
      expect(row(tables, 'folio_annotations', 'fa-folio')).toMatchObject({
        source_description: 'folio row, not to be touched',
      });
    });

    it('[AC1] upsert-folio-annotation with no work-type row is a warning, not an error', async () => {
      const tables = metadataWorld();
      tables.folio_annotations = tables.folio_annotations.filter(
        (r) => r.work_uuid !== WORK || r.annotation_type !== 'work',
      );

      const { result } = await run(tables, [
        {
          op: 'upsert-folio-annotation',
          patch: { source_description: 'new' },
        },
      ]);

      expect(result.success).toBe(true);
      expect(group(result, 'work-metadata').applied).toBe(true);
      expect(group(result, 'work-metadata').warnings.length).toBeGreaterThan(0);
      expect(group(result, 'work-metadata').error).toBeUndefined();
    });
  });

  describe('AC2: a dry run returns the planned changes and writes nothing', () => {
    it('[AC2] a dry run of an import plans work, title, folio and passage changes', async () => {
      const tables = metadataWorld();
      const { result } = await run(tables, importOps(), { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.notAttempted).toEqual([]);
      expect(result.groups.map((g: Group) => g.group)).toEqual([
        'work-metadata',
        'passages',
      ]);
      // Planned, not applied.
      expect(result.groups.map((g: Group) => g.applied)).toEqual([
        false,
        false,
      ]);

      const metadata = group(result, 'work-metadata').changes;
      expect(metadata.group).toBe('work-metadata');
      expect(metadata.work.fields).toEqual({
        toh: { from: 'toh1', to: 'toh44' },
        restriction: { from: false, to: true },
      });
      expect(metadata.titles).toHaveLength(2);
      const update = metadata.titles.find((t: Row) => t.action === 'update');
      expect(update).toMatchObject({
        uuid: 't-en-main',
        type: 'mainTitle',
        language: 'en',
        content: 'The Blessed One',
        previous: 'Old Title',
      });
      const insert = metadata.titles.find((t: Row) => t.action === 'insert');
      expect(insert).toMatchObject({
        type: 'longTitle',
        language: 'Sa-Ltn',
        content: 'Bhagavān',
      });
      expect(insert.uuid).toEqual(expect.any(String));
      expect(metadata.folioAnnotation).toEqual({
        rows: 1,
        fields: { source_description: 'Degé Kangyur, volume 1' },
      });

      const passages = group(result, 'passages').changes;
      expect(passages.group).toBe('passages');
      expect(passages.passages).toEqual([
        expect.objectContaining({
          uuid: derived(0),
          label: '1',
          sort: 0,
          action: 'insert',
          annotations: 1,
          xmlId: 'docx-0',
        }),
        expect.objectContaining({
          uuid: derived(1),
          label: '2',
          sort: 1,
          action: 'insert',
          annotations: 2,
          xmlId: 'docx-1',
        }),
      ]);
    });

    it('[AC2] a dry run of an import writes nothing: no table changes, no write, no rpc', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      const { world } = await run(tables, importOps(), { dryRun: true });

      expect(snapshot(tables)).toEqual(before);
      expect(world.writes).toEqual([]);
    });

    it('[AC2] a dry run reports a passage already stored under its derived uuid as an update', async () => {
      const tables = metadataWorld();
      tables.passages = [
        {
          uuid: derived(0),
          work_uuid: WORK,
          content: 'older text',
          label: '1',
          sort: 0,
          type: 'translation',
          xmlId: 'docx-0',
        },
      ];
      const before = snapshot(tables);

      const { result, world } = await run(tables, importOps().slice(4), {
        dryRun: true,
      });

      const { passages } = group(result, 'passages').changes;
      expect(passages.find((p: Row) => p.uuid === derived(0)).action).toBe(
        'update',
      );
      expect(passages.find((p: Row) => p.uuid === derived(1)).action).toBe(
        'insert',
      );
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC2] a dry run of an edit flow returns the planned passages and writes nothing', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, world } = await run(tables, editOps(), { dryRun: true });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(group(result, 'passages').applied).toBe(false);
      const { passages } = group(result, 'passages').changes;
      expect(passages.find((p: Row) => p.uuid === 'p1').content).toBe(
        'Then the lord  said this',
      );
      expect(passages.some((p: Row) => p.content === 'Inserted passage.')).toBe(
        true,
      );
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC2] a dry run whose plan fails reports it, with nothing written', async () => {
      const tables = metadataWorld();
      const { result, world } = await run(
        tables,
        [
          {
            op: 'update-work',
            patch: { toh: 'toh44' },
            expect: { toh: 'toh99' },
          },
        ],
        { dryRun: true },
      );

      expect(result.success).toBe(false);
      expect(result.dryRun).toBe(true);
      expect(result.error).toContain('toh');
      expect(group(result, 'work-metadata')).toMatchObject({ applied: false });
      expect(world.writes).toEqual([]);
    });
  });

  describe('AC3: a later group fails after an earlier group committed', () => {
    const mixedOps = () => [
      { op: 'update-work', patch: { toh: 'toh44' } },
      {
        op: 'upsert-title',
        title: {
          content: 'The Blessed One',
          type: 'mainTitle',
          language: 'en',
        },
      },
      {
        op: 'delete-text',
        passageUuid: 'p1',
        start: 14,
        end: 22,
        text: '[F.90.a]',
      },
    ];

    it('[AC3] passages fails on commit after work-metadata committed: metadata applied true, passages applied false', async () => {
      const tables = editWorld();
      const { result } = await run(tables, mixedOps(), {
        failures: [{ target: 'apply_passage_save', mode: 'rolled-back' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toEqual(expect.any(String));
      expect(result.groups.map((g: Group) => g.group)).toEqual([
        'work-metadata',
        'passages',
      ]);
      expect(group(result, 'work-metadata').applied).toBe(true);
      expect(group(result, 'passages').applied).toBe(false);
      expect(group(result, 'passages').error).toEqual(expect.any(String));
      expect(result.notAttempted).toEqual([]);

      // The earlier group stays committed, the failed one wrote nothing.
      expect(workRow(tables).toh).toBe('toh44');
      expect(row(tables, 'titles', 't-en-main')?.content).toBe(
        'The Blessed One',
      );
      expect(row(tables, 'passages', 'p1')?.content).toBe(CONTENT);
    });

    it('[AC3] passages commit with a lost response reports "unknown", not false', async () => {
      const tables = editWorld();
      const { result } = await run(tables, mixedOps(), {
        failures: [{ target: 'apply_passage_save', mode: 'lost-response' }],
      });

      expect(result.success).toBe(false);
      expect(group(result, 'work-metadata').applied).toBe(true);
      expect(group(result, 'passages').applied).toBe('unknown');
      expect(result.error).toEqual(expect.any(String));
    });

    it('[AC3] work-metadata fails on commit: it is not applied and passages is notAttempted', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      const { result, world } = await run(tables, importOps(), {
        failures: [{ target: 'works', mode: 'rolled-back' }],
      });

      expect(result.success).toBe(false);
      expect(result.error).toEqual(expect.any(String));
      const metadata = group(result, 'work-metadata');
      expect([false, 'unknown']).toContain(metadata.applied);
      expect(metadata.error).toEqual(expect.any(String));
      expect(result.notAttempted).toEqual(['passages']);
      expect(
        result.groups.some(
          (g: Group) => g.group === 'passages' && g.applied === true,
        ),
      ).toBe(false);

      // Passages were never written.
      expect(
        world.writes.filter((w) => w.target === 'apply_passage_save'),
      ).toEqual([]);
      expect(tables.passages).toEqual(before.passages);
      expect(tables.passage_annotations).toEqual(before.passage_annotations);
      // "false" means known to have written nothing.
      if (metadata.applied === false) {
        expect(snapshot(tables)).toEqual(before);
      }
    });

    it('[AC3] a work-metadata group that wrote part of itself before failing never claims false', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      // update-work and upsert-title are separate writes: fail the title one.
      const { result } = await run(
        tables,
        [
          { op: 'update-work', patch: { toh: 'toh44' } },
          {
            op: 'upsert-title',
            title: {
              content: 'A new title',
              type: 'longTitle',
              language: 'Sa-Ltn',
            },
          },
          ...importOps().slice(4),
        ],
        { failures: [{ target: 'titles', mode: 'rolled-back' }] },
      );

      expect(result.success).toBe(false);
      const metadata = group(result, 'work-metadata');
      expect([false, 'unknown']).toContain(metadata.applied);
      // `false` is claimed only when it holds: nothing of the group was
      // written. A group that wrote part of itself must say "unknown".
      if (metadata.applied === false) {
        expect(snapshot(tables)).toEqual(before);
      }
      expect(result.notAttempted).toEqual(['passages']);
      expect(passagesOf(tables)).toEqual([]);
    });

    it('[AC3] a write whose response was lost in work-metadata reports "unknown" and stops the call', async () => {
      const tables = metadataWorld();
      const { result } = await run(tables, importOps(), {
        failures: [{ target: 'works', mode: 'lost-response' }],
      });

      expect(result.success).toBe(false);
      expect(group(result, 'work-metadata').applied).toBe('unknown');
      expect(result.notAttempted).toEqual(['passages']);
      expect(passagesOf(tables)).toEqual([]);
    });

    it('[AC3] a failed expect guard in one group writes nothing in any group', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      const { result, world } = await run(tables, [
        {
          op: 'update-work',
          patch: { toh: 'toh44' },
          expect: { toh: 'not-the-stored-value' },
        },
        ...importOps().slice(4),
      ]);

      expect(result.success).toBe(false);
      expect(group(result, 'work-metadata')).toMatchObject({ applied: false });
      expect(group(result, 'work-metadata').error).toEqual(expect.any(String));
      expect(result.notAttempted).toEqual(['passages']);
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[AC3] a text guard on add-annotation that does not match writes nothing', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, world } = await run(tables, [
        { op: 'update-work', patch: { toh: 'toh44' } },
        {
          op: 'add-annotation',
          passageUuid: 'p1',
          kind: 'span',
          start: 9,
          end: 13,
          text: 'lord!',
          data: { textStyle: 'emphasis' },
        },
      ]);

      expect(result.success).toBe(false);
      expect(group(result, 'passages')).toMatchObject({ applied: false });
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });
  });

  describe('conventions', () => {
    it('[CONV expect] a mismatch is refused before any write, and the error names the field, the expected and the stored value', async () => {
      const tables = metadataWorld();
      const before = snapshot(tables);

      const { result, world } = await run(tables, [
        {
          op: 'update-work',
          patch: { restriction: true },
          expect: { toh: 'toh99' },
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('toh');
      expect(result.error).toContain('toh99');
      expect(result.error).toContain('toh1');
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[CONV expect] matching values pass: deep equality, and null matches a stored null', async () => {
      const tables = metadataWorld();
      const { result } = await run(tables, [
        {
          op: 'update-work',
          patch: { toh: 'toh44' },
          expect: { toh: 'toh1', note: null, meta: { a: [1, 2] } },
        },
      ]);

      expect(result.success).toBe(true);
      expect(workRow(tables).toh).toBe('toh44');
    });

    it('[CONV expect] a deep value that differs is refused, and null does not match a stored value', async () => {
      const tables = metadataWorld();
      const differs = await run(tables, [
        {
          op: 'update-work',
          patch: { toh: 'toh44' },
          expect: { meta: { a: [1, 3] } },
        },
      ]);
      expect(differs.result.success).toBe(false);
      expect(differs.result.error).toContain('meta');

      const notNull = await run(tables, [
        { op: 'update-work', patch: { toh: 'toh44' }, expect: { toh: null } },
      ]);
      expect(notNull.result.success).toBe(false);
      expect(notNull.result.error).toContain('toh');
      expect(workRow(tables).toh).toBe('toh1');
    });

    it('[CONV expect] upsert-title checks expect against the stored row in its slot', async () => {
      const ok = metadataWorld();
      const accepted = await run(ok, [
        {
          op: 'upsert-title',
          title: { content: 'Renamed', type: 'mainTitle', language: 'en' },
          expect: { content: 'Old Title' },
        },
      ]);
      expect(accepted.result.success).toBe(true);
      expect(row(ok, 'titles', 't-en-main')?.content).toBe('Renamed');

      const bad = metadataWorld();
      const before = snapshot(bad);
      const refused = await run(bad, [
        {
          op: 'upsert-title',
          title: { content: 'Renamed', type: 'mainTitle', language: 'en' },
          expect: { content: 'Not the stored title' },
        },
      ]);
      expect(refused.result.success).toBe(false);
      expect(refused.result.error).toContain('content');
      expect(refused.world.writes).toEqual([]);
      expect(snapshot(bad)).toEqual(before);
    });

    it('[CONV expect] upsert-folio-annotation checks expect against every work-type row', async () => {
      const tables = metadataWorld();
      tables.folio_annotations.push({
        uuid: 'fa-work-2',
        work_uuid: WORK,
        annotation_type: 'work',
        source_description: 'a second row that differs',
      });
      const before = snapshot(tables);

      const { result, world } = await run(tables, [
        {
          op: 'upsert-folio-annotation',
          patch: { source_description: 'new' },
          expect: { source_description: 'old description' },
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('source_description');
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[CONV expect] upsert-folio-annotation expect passes when every row matches', async () => {
      const tables = metadataWorld();
      const { result } = await run(tables, [
        {
          op: 'upsert-folio-annotation',
          patch: { source_description: 'new' },
          expect: { source_description: 'old description' },
        },
      ]);

      expect(result.success).toBe(true);
      expect(row(tables, 'folio_annotations', 'fa-work')).toMatchObject({
        source_description: 'new',
      });
    });

    it('[CONV group order] work-metadata commits before passages whatever the order of the list', async () => {
      const tables = editWorld();
      const { result, world } = await run(tables, [
        // passages ops first, metadata ops last
        ...editOps(),
        { op: 'update-work', patch: { toh: 'toh44' } },
      ]);

      expect(result.success).toBe(true);
      expect(result.groups.map((g: Group) => g.group)).toEqual([
        'work-metadata',
        'passages',
      ]);
      const first = (target: string) =>
        world.writes.findIndex((w) => w.target === target);
      expect(first('works')).toBeGreaterThanOrEqual(0);
      expect(first('apply_passage_save')).toBeGreaterThanOrEqual(0);
      expect(first('works')).toBeLessThan(first('apply_passage_save'));
    });

    it('[CONV mixing] upsert-passage together with an edit op is refused before anything is written', async () => {
      const tables = editWorld();
      const before = snapshot(tables);

      const { result, world } = await run(tables, [
        { op: 'update-work', patch: { toh: 'toh44' } },
        importOps()[4],
        {
          op: 'delete-text',
          passageUuid: 'p1',
          start: 14,
          end: 22,
          text: '[F.90.a]',
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(expect.any(String));
      expect(result.error.length).toBeGreaterThan(0);
      expect([...result.notAttempted].sort()).toEqual([
        'passages',
        'work-metadata',
      ]);
      expect(result.groups.every((g: Group) => g.applied !== true)).toBe(true);
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });

    it('[CONV mixing] each of the four edit ops is refused alongside an upsert-passage', async () => {
      for (const edit of editOps()) {
        const tables = editWorld();
        const before = snapshot(tables);
        const { result, world } = await run(tables, [importOps()[4], edit]);

        expect(result.success).toBe(false);
        expect(result.notAttempted).toContain('passages');
        expect(world.writes).toEqual([]);
        expect(snapshot(tables)).toEqual(before);
      }
    });

    it('[CONV edit ops] a passage not in the work is refused with nothing written', async () => {
      const tables = editWorld();
      tables.passages.push({
        uuid: 'p-elsewhere',
        work_uuid: OTHER_WORK,
        content: 'Another work',
        label: '1',
        sort: 1,
        type: 'translation',
        xmlId: 'o-1',
      });
      const before = snapshot(tables);

      const { result, world } = await run(tables, [
        {
          op: 'remove-annotation',
          passageUuid: 'p-elsewhere',
          annotationUuid: 'x',
        },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('p-elsewhere');
      expect(world.writes).toEqual([]);
      expect(snapshot(tables)).toEqual(before);
    });
  });
});
