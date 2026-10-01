import type { DataClient } from '../../types';
import { normalizePassageLabelsAfter } from './labels';

type Row = { uuid: string; label: string | null; sort: number; toh: null };

/** A client over one work's passages that records the label upserts. */
const fakeClient = (rows: Row[]) => {
  const upserts: { uuid: string; label: string }[] = [];
  const client = {
    from: () => {
      let after = -Infinity;
      let inclusive = false;
      const query = {
        select: () => query,
        eq: () => query,
        gt: (_: string, sort: number) => ((after = sort), query),
        gte: (_: string, sort: number) => (
          (after = sort),
          (inclusive = true),
          query
        ),
        order: () => query,
        limit: async () => ({
          data: rows.filter((row) =>
            inclusive ? row.sort >= after : row.sort > after,
          ),
          error: null,
        }),
        upsert: async (updates: { uuid: string; label: string }[]) => {
          upserts.push(...updates);
          return { error: null };
        },
      };
      return query;
    },
    rpc: async () => ({ error: null }),
  } as unknown as DataClient;
  return { client, upserts };
};

describe('normalizePassageLabelsAfter', () => {
  it('walks past an unlabelled passage without giving it a number', async () => {
    // n.2 was inserted at sort 2; the rows after it still hold the old labels.
    const { client, upserts } = fakeClient([
      { uuid: 'blank', label: '', sort: 3, toh: null },
      { uuid: 'a', label: 'n.2', sort: 4, toh: null },
      { uuid: 'b', label: 'n.3', sort: 5, toh: null },
    ]);

    await normalizePassageLabelsAfter({
      client,
      workUuid: 'w1',
      fromSort: 2,
      fromLabel: 'n.2',
      delta: 1,
    });

    expect(upserts).toEqual([
      { uuid: 'a', label: 'n.3' },
      { uuid: 'b', label: 'n.4' },
    ]);
  });
});
