import type { DataClient } from '@eightyfourthousand/data-access';
import { resolveDraftWork } from './read-draft';

const WORK = '2cd55d9c-a17c-4d9f-9fce-e32e05b0192d';

/**
 * A client whose tables answer `.maybeSingle()` from fixed rows and log the order in
 * which they were read. `onRead` runs before a table answers, to simulate an edit
 * committing between two reads.
 */
const fakeClient = (
  rows: Record<string, Record<string, unknown> | null>,
  onRead: (table: string) => void = () => undefined,
) => {
  const reads: string[] = [];
  const client = {
    from: (table: string) => {
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => {
          reads.push(table);
          const data = rows[table] ?? null;
          onRead(table);
          return { data, error: null };
        },
      };
      return builder;
    },
  } as unknown as DataClient;
  return { client, reads };
};

describe('resolveDraftWork', () => {
  it('reads the draft key before any rendered work metadata', async () => {
    const { client, reads } = fakeClient({
      work_toh: { work_uuid: WORK },
      work_publish_status: { draft_touched_at: '2026-10-13T10:00:00Z' },
      works: { uuid: WORK, toh: 'toh145', title: 'T' },
    });
    await resolveDraftWork({ client, work: 'toh145' });
    expect(reads.indexOf('work_publish_status')).toBeLessThan(
      reads.indexOf('works'),
    );
  });

  it('pairs an edit that lands between the reads with the OLD key, so it reads as stale', async () => {
    // The key row and the works row are both "edited" the moment the key has been read.
    const rows: Record<string, Record<string, unknown>> = {
      work_publish_status: { draft_touched_at: '2026-10-13T10:00:00Z' },
      works: { uuid: WORK, toh: 'toh145', title: 'Old title' },
    };
    const { client } = fakeClient(rows, (table) => {
      if (table === 'work_publish_status') {
        rows.works = { uuid: WORK, toh: 'toh145', title: 'New title' };
        rows.work_publish_status = { draft_touched_at: '2026-10-13T10:05:00Z' };
      }
    });
    const work = await resolveDraftWork({ client, work: WORK });
    // New content under the old key: the live key has moved on, so the next equality
    // check sees a stale snapshot. The reverse pairing would look current forever.
    expect(work).toMatchObject({
      title: 'New title',
      draftTouchedAt: '2026-10-13T10:00:00Z',
    });
  });

  it('returns null for a work that does not exist', async () => {
    const { client } = fakeClient({ work_publish_status: null, works: null });
    await expect(resolveDraftWork({ client, work: WORK })).resolves.toBeNull();
  });

  it('keeps a never-touched work, with a null key', async () => {
    const { client } = fakeClient({
      work_publish_status: null,
      works: { uuid: WORK, toh: 'toh1, toh2', title: null },
    });
    await expect(resolveDraftWork({ client, work: WORK })).resolves.toEqual({
      uuid: WORK,
      tohs: ['toh1', 'toh2'],
      title: null,
      draftTouchedAt: null,
    });
  });
});
