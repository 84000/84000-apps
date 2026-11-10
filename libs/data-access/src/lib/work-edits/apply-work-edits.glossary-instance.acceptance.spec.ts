/**
 * Acceptance tests for DEV-907, `applyWorkEdits` and glossary instances,
 * written from TASK.md alone (the MCP write path). Each test names the
 * criterion it covers:
 *
 *  AC2  an `add-annotation` op for a `glossary-instance` with only a
 *       `glossary` uuid succeeds and stores no `authority`; a caller-sent
 *       `authority` is ignored and not stored
 *  AC4  an instance stored with no `authority` survives an edit to its passage
 *  AC5  an instance stored with `authority` survives an edit unchanged in
 *       what links it to its entry
 *
 * Uses the in-memory client fixture from the DEV-894 acceptance suite.
 */
import { applyWorkEdits } from '../../index';
import {
  WORK,
  createFakeClient,
  editWorld,
  type Row,
  type Tables,
} from './apply-work-edits.acceptance-fixture';

const GLOSSARY = 'a1a1a1a1-0000-4000-8000-000000000001';
const AUTHORITY = 'b2b2b2b2-0000-4000-8000-000000000002';

// editWorld's p1 reads 'Then the lord [F.90.a] said this'; 'lord' is 9-13.
const run = async (tables: Tables, ops: unknown[]) => {
  const { client } = createFakeClient(tables);
  return applyWorkEdits({ client, workUuid: WORK, ops: ops as never });
};

const instancesOn = (tables: Tables, passage: string): Row[] =>
  tables.passage_annotations.filter(
    (a) => a.passage_uuid === passage && a.type === 'glossary-instance',
  );

const contentOf = (row: Row) =>
  (row.content as Record<string, unknown>[]) ?? [];

const keysOf = (row: Row) =>
  contentOf(row).flatMap((part) => Object.keys(part));

/** Stored JSON: what the database would hold. */
const asStored = (row: Row) => JSON.parse(JSON.stringify(row)) as Row;

const addInstance = (data: Record<string, unknown>) => ({
  op: 'add-annotation',
  passageUuid: 'p1',
  kind: 'glossary-instance',
  start: 9,
  end: 13,
  text: 'lord',
  data,
});

const worldWithStoredInstance = (content: Record<string, unknown>[]) => {
  const tables = editWorld();
  tables.passage_annotations.push({
    uuid: 'a-instance',
    passage_uuid: 'p1',
    type: 'glossary-instance',
    start: 9,
    end: 13,
    content,
    toh: null,
  });
  return tables;
};

describe('applyWorkEdits, glossary instances (DEV-907)', () => {
  it('[AC2] add-annotation with only a glossary uuid succeeds and stores no authority', async () => {
    const tables = editWorld();
    const result = await run(tables, [addInstance({ glossary: GLOSSARY })]);

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
    const [row] = instancesOn(tables, 'p1');
    expect(row).toBeDefined();
    expect(row).toMatchObject({ start: 9, end: 13 });
    expect(contentOf(asStored(row)).some((p) => p.uuid === GLOSSARY)).toBe(
      true,
    );
    expect(keysOf(asStored(row))).not.toContain('authority');
  });

  it('[AC2] a caller-sent authority is ignored: the op succeeds and the authority is not stored', async () => {
    const tables = editWorld();
    const result = await run(tables, [
      addInstance({ glossary: GLOSSARY, authority: AUTHORITY }),
    ]);

    expect(result.success).toBe(true);
    const [row] = instancesOn(tables, 'p1');
    expect(row).toBeDefined();
    expect(contentOf(asStored(row)).some((p) => p.uuid === GLOSSARY)).toBe(
      true,
    );
    expect(keysOf(asStored(row))).not.toContain('authority');
    expect(JSON.stringify(asStored(row))).not.toContain(AUTHORITY);
  });

  it('[AC2] a dry run plans the instance (does not drop it) and writes nothing', async () => {
    const tables = editWorld();
    const before = JSON.stringify(tables);
    const { client, world } = createFakeClient(tables);
    const result = await applyWorkEdits({
      client,
      workUuid: WORK,
      ops: [addInstance({ glossary: GLOSSARY })] as never,
      dryRun: true,
    });

    expect(result.success).toBe(true);
    expect(result.dryRun).toBe(true);
    expect(world.writes).toEqual([]);
    expect(JSON.stringify(tables)).toBe(before);
  });

  it('[AC2] upsert-passage accepts a glossary-instance annotation with only a glossary uuid', async () => {
    const tables = editWorld();
    const content = 'Thus the lord spoke.';
    const result = await run(tables, [
      {
        op: 'upsert-passage',
        passage: { label: '9', type: 'translation', content },
        annotations: [
          {
            kind: 'glossary-instance',
            start: 5,
            end: 9,
            data: { glossary: GLOSSARY },
          },
        ],
      },
    ]);

    expect(result.success).toBe(true);
    const rows = tables.passage_annotations.filter(
      (a) => a.type === 'glossary-instance' && a.start === 5,
    );
    expect(rows).toHaveLength(1);
    expect(contentOf(asStored(rows[0])).some((p) => p.uuid === GLOSSARY)).toBe(
      true,
    );
    expect(keysOf(asStored(rows[0]))).not.toContain('authority');
  });

  it('[AC4] an instance stored without authority survives an edit to its passage, shifted with the text', async () => {
    const tables = worldWithStoredInstance([{ uuid: GLOSSARY }]);
    const result = await run(tables, [
      // Remove the folio marker after the instance, and "Then " before it.
      {
        op: 'delete-text',
        passageUuid: 'p1',
        start: 0,
        end: 5,
        text: 'Then ',
      },
    ]);

    expect(result.success).toBe(true);
    const [row] = instancesOn(tables, 'p1');
    expect(row).toBeDefined();
    expect(row.uuid).toBe('a-instance');
    expect(row).toMatchObject({ start: 4, end: 8 });
    expect(contentOf(asStored(row)).some((p) => p.uuid === GLOSSARY)).toBe(
      true,
    );
    expect(keysOf(asStored(row))).not.toContain('authority');
  });

  it('[AC5] an instance stored with authority survives an edit to its passage and keeps its glossary uuid', async () => {
    const tables = worldWithStoredInstance([
      { uuid: GLOSSARY },
      { authority: AUTHORITY },
    ]);
    const result = await run(tables, [
      {
        op: 'delete-text',
        passageUuid: 'p1',
        start: 0,
        end: 5,
        text: 'Then ',
      },
    ]);

    expect(result.success).toBe(true);
    const [row] = instancesOn(tables, 'p1');
    expect(row).toBeDefined();
    expect(row).toMatchObject({ start: 4, end: 8 });
    expect(contentOf(asStored(row)).some((p) => p.uuid === GLOSSARY)).toBe(
      true,
    );
  });
});
