import { saveWorkTitles } from './titles';
import type { DataClient, Title } from './types';

type InsertCall = { rows: Record<string, unknown>[] };
type UpdateCall = { patch: Record<string, unknown>; uuid: unknown };
type DeleteCall = { uuids: unknown };

interface Calls {
  inserts: InsertCall[];
  updates: UpdateCall[];
  deletes: DeleteCall[];
}

/**
 * Minimal chainable Supabase stub. Each terminal call records what it was
 * given and resolves with the error configured for that operation, so the diff
 * and the failure handling can both be exercised without a database.
 */
const makeFakeClient = (
  calls: Calls,
  errors: Partial<Record<'insert' | 'update' | 'delete', string>> = {},
  /**
   * UUIDs RLS lets through. `undefined` means every row is returned, matching a
   * caller that holds `editor.admin`.
   */
  visible?: string[],
): DataClient => {
  return {
    from(table: string) {
      if (table !== 'titles') {
        throw new Error(`unexpected table: ${table}`);
      }
      const ctx: {
        op?: 'insert' | 'update' | 'delete';
        patch?: Record<string, unknown>;
        uuid?: unknown;
        uuids?: string[];
      } = {};
      const builder = {
        insert(rows: Record<string, unknown>[]) {
          ctx.op = 'insert';
          calls.inserts.push({ rows });
          return builder;
        },
        update(patch: Record<string, unknown>) {
          ctx.op = 'update';
          ctx.patch = patch;
          return builder;
        },
        delete() {
          ctx.op = 'delete';
          return builder;
        },
        eq(_col: string, val: unknown) {
          ctx.uuid = val;
          return builder;
        },
        in(_col: string, vals: unknown) {
          ctx.uuids = vals as string[];
          calls.deletes.push({ uuids: vals });
          return builder;
        },
        select(_cols?: string) {
          return builder;
        },
        then(
          resolve: (value: {
            data: { uuid: string }[] | null;
            error: { message: string } | null;
          }) => void,
        ) {
          if (ctx.op === 'update') {
            calls.updates.push({ patch: ctx.patch ?? {}, uuid: ctx.uuid });
          }
          const message = ctx.op ? errors[ctx.op] : undefined;
          if (message) {
            resolve({ data: null, error: { message } });
            return;
          }
          // The rows the statement targeted, minus anything RLS filters out.
          const targeted =
            ctx.op === 'delete' ? (ctx.uuids ?? []) : [ctx.uuid as string];
          const returned = visible
            ? targeted.filter((uuid) => visible.includes(uuid))
            : targeted;
          resolve({ data: returned.map((uuid) => ({ uuid })), error: null });
        },
      };
      return builder;
    },
  } as unknown as DataClient;
};

const title = (overrides: Partial<Title> = {}): Title => ({
  uuid: 'title-1',
  title: 'The Perfection of Wisdom',
  language: 'en',
  type: 'mainTitle',
  ...overrides,
});

const emptyCalls = (): Calls => ({ inserts: [], updates: [], deletes: [] });

describe('saveWorkTitles', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('inserts a title that has no counterpart in the original set', async () => {
    const calls = emptyCalls();
    const existing = title();
    const added = title({ uuid: 'title-2', title: 'Toh 12', type: 'toh' });

    const result = await saveWorkTitles({
      client: makeFakeClient(calls),
      workUuid: 'work-1',
      titles: [existing, added],
      original: [existing],
    });

    expect(result).toEqual({ inserted: 1, updated: 0, deleted: 0 });
    expect(calls.inserts).toEqual([
      {
        rows: [
          {
            uuid: 'title-2',
            work_uuid: 'work-1',
            content: 'Toh 12',
            type: 'eft:toh',
            language: 'en',
          },
        ],
      },
    ]);
    expect(calls.updates).toEqual([]);
    expect(calls.deletes).toEqual([]);
  });

  it('updates a title whose text, type, or language changed', async () => {
    const calls = emptyCalls();
    const original = title();

    const result = await saveWorkTitles({
      client: makeFakeClient(calls),
      workUuid: 'work-1',
      titles: [title({ title: 'The Noble Perfection of Wisdom' })],
      original: [original],
    });

    expect(result).toEqual({ inserted: 0, updated: 1, deleted: 0 });
    expect(calls.updates).toEqual([
      {
        uuid: 'title-1',
        patch: {
          content: 'The Noble Perfection of Wisdom',
          type: 'eft:mainTitle',
          language: 'en',
        },
      },
    ]);
  });

  it('leaves an untouched title alone', async () => {
    const calls = emptyCalls();
    const original = title();

    const result = await saveWorkTitles({
      client: makeFakeClient(calls),
      workUuid: 'work-1',
      titles: [title()],
      original: [original],
    });

    expect(result).toEqual({ inserted: 0, updated: 0, deleted: 0 });
    expect(calls.inserts).toEqual([]);
    expect(calls.updates).toEqual([]);
    expect(calls.deletes).toEqual([]);
  });

  it('deletes a title dropped from the edited set', async () => {
    const calls = emptyCalls();
    const kept = title();
    const dropped = title({ uuid: 'title-2', title: 'Toh 12', type: 'toh' });

    const result = await saveWorkTitles({
      client: makeFakeClient(calls),
      workUuid: 'work-1',
      titles: [kept],
      original: [kept, dropped],
    });

    expect(result).toEqual({ inserted: 0, updated: 0, deleted: 1 });
    expect(calls.deletes).toEqual([{ uuids: ['title-2'] }]);
  });

  it('applies an insert, an update, and a delete in one save', async () => {
    const calls = emptyCalls();
    const edited = title();
    const dropped = title({ uuid: 'title-2', title: 'Toh 12', type: 'toh' });
    const added = title({ uuid: 'title-3', title: 'ཤེས་རབ།', language: 'bo' });

    const result = await saveWorkTitles({
      client: makeFakeClient(calls),
      workUuid: 'work-1',
      titles: [title({ title: 'Renamed' }), added],
      original: [edited, dropped],
    });

    expect(result).toEqual({ inserted: 1, updated: 1, deleted: 1 });
    expect(calls.inserts[0].rows[0]).toMatchObject({ uuid: 'title-3' });
    expect(calls.updates[0]).toMatchObject({ uuid: 'title-1' });
    expect(calls.deletes[0]).toEqual({ uuids: ['title-2'] });
  });

  it('reports the error and stops when a write is rejected', async () => {
    const calls = emptyCalls();
    const kept = title();

    const result = await saveWorkTitles({
      client: makeFakeClient(calls, {
        insert: 'new row violates row-level security policy',
      }),
      workUuid: 'work-1',
      titles: [kept, title({ uuid: 'title-2', title: 'Toh 12', type: 'toh' })],
      original: [kept, title({ uuid: 'title-3', title: 'gone' })],
    });

    expect(result).toEqual({
      inserted: 0,
      updated: 0,
      deleted: 0,
      error: 'new row violates row-level security policy',
    });
    // The delete must not run once the insert failed.
    expect(calls.deletes).toEqual([]);
  });

  it('reports a refusal when an update silently affects no rows', async () => {
    const calls = emptyCalls();
    const original = title();

    // RLS filters UPDATE rather than rejecting it, so a caller without
    // editor.admin sees no error and no returned rows.
    const result = await saveWorkTitles({
      client: makeFakeClient(calls, {}, []),
      workUuid: 'work-1',
      titles: [title({ title: 'Renamed' })],
      original: [original],
    });

    expect(result.updated).toBe(0);
    expect(result.error).toContain('editor.admin');
  });

  it('reports a refusal when a delete silently affects no rows', async () => {
    const calls = emptyCalls();
    const kept = title();
    const dropped = title({ uuid: 'title-2', title: 'Toh 12', type: 'toh' });

    const result = await saveWorkTitles({
      client: makeFakeClient(calls, {}, []),
      workUuid: 'work-1',
      titles: [kept],
      original: [kept, dropped],
    });

    expect(result.deleted).toBe(0);
    expect(result.error).toContain('editor.admin');
  });

  it('reports a refusal when only some deletes get through', async () => {
    const calls = emptyCalls();
    const kept = title();
    const a = title({ uuid: 'title-2', title: 'Toh 12', type: 'toh' });
    const b = title({ uuid: 'title-3', title: 'Short', type: 'shortcode' });

    const result = await saveWorkTitles({
      client: makeFakeClient(calls, {}, ['title-2']),
      workUuid: 'work-1',
      titles: [kept],
      original: [kept, a, b],
    });

    expect(result.deleted).toBe(1);
    expect(result.error).toContain('editor.admin');
  });

  it('keeps the counts already applied when a later write fails', async () => {
    const calls = emptyCalls();
    const kept = title();

    const result = await saveWorkTitles({
      client: makeFakeClient(calls, { delete: 'permission denied' }),
      workUuid: 'work-1',
      titles: [kept, title({ uuid: 'title-2', title: 'Toh 12', type: 'toh' })],
      original: [kept, title({ uuid: 'title-3', title: 'gone' })],
    });

    expect(result).toEqual({
      inserted: 1,
      updated: 0,
      deleted: 0,
      error: 'permission denied',
    });
  });
});
