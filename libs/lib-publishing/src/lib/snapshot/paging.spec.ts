import { readByIn, readKeyset } from './paging';

type Row = Record<string, string | number | null>;

/**
 * An in-memory stand-in for the PostgREST builder, implementing just the filters the
 * paging helpers use, including the keyset `.or()` they build.
 */
const table = (rows: Row[], log: { inSizes: number[] } = { inSizes: [] }) => {
  const query = () => {
    const filters: ((r: Row) => boolean)[] = [];
    const orders: string[] = [];
    let limit = Infinity;
    const cmp = (a: Row[string], b: Row[string]) =>
      a === b ? 0 : a === null ? 1 : b === null ? -1 : a < b ? -1 : 1;
    const value = (raw: string, sample: Row[string]) => {
      const v = JSON.parse(raw);
      return typeof sample === 'number' ? Number(v) : v;
    };
    const builder = {
      select: () => builder,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), builder),
      in: (c: string, vs: unknown[]) => {
        log.inSizes.push(vs.length);
        filters.push((r) => vs.includes(r[c]));
        return builder;
      },
      gt: (c: string, v: Row[string]) => (
        filters.push((r) => r[c] !== null && cmp(r[c], v) > 0),
        builder
      ),
      is: (c: string) => (filters.push((r) => r[c] === null), builder),
      not: (c: string) => (filters.push((r) => r[c] !== null), builder),
      or: (expr: string) => {
        const m =
          /^(\w+)\.gt\.("(?:[^"\\]|\\.)*"),and\(\1\.eq\.\2,(\w+)\.gt\.("(?:[^"\\]|\\.)*")\)$/.exec(
            expr,
          );
        if (!m) throw new Error(`unsupported or: ${expr}`);
        const [, s, sv, id, iv] = m;
        filters.push((r) => {
          const sortValue = value(sv, r[s]);
          return (
            cmp(r[s], sortValue) > 0 ||
            (cmp(r[s], sortValue) === 0 && cmp(r[id], value(iv, r[id])) > 0)
          );
        });
        return builder;
      },
      order: (c: string) => (orders.push(c), builder),
      limit: (n: number) => ((limit = n), builder),
      then: (resolve: (r: { data: Row[]; error: null }) => void) => {
        const data = rows
          .filter((r) => filters.every((f) => f(r)))
          .sort((a, b) => {
            for (const c of orders) {
              const d = cmp(a[c], b[c]);
              if (d) return d;
            }
            return 0;
          })
          .slice(0, limit);
        resolve({ data, error: null });
      },
    };
    return builder;
  };
  return { from: () => query(), log };
};

// Sorts repeat (as they do across a multi-Toh work), and two rows have no sort.
const rows: Row[] = Array.from({ length: 23 }, (_, i) => ({
  uuid: `u-${String((i * 7) % 23).padStart(2, '0')}`,
  sort: i === 4 || i === 11 ? null : Math.floor(i / 3),
  work: 'w',
}));

describe('readKeyset', () => {
  it('returns every row once, whatever the page size', async () => {
    const client = table(rows);
    for (const pageSize of [1, 2, 3, 5, 1000]) {
      const out = await readKeyset<Row>({
        build: () => client.from().select().eq('work', 'w'),
        sortColumn: 'sort',
        idColumn: 'uuid',
        nullableSort: true,
        what: 'rows',
        pageSize,
      });
      expect(out).toHaveLength(rows.length);
      expect(new Set(out.map((r) => r.uuid)).size).toBe(rows.length);
      expect(out.slice(-2).every((r) => r.sort === null)).toBe(true);
    }
  });

  it('keeps reading order: sort, then uuid', async () => {
    const client = table(rows);
    const out = await readKeyset<Row>({
      build: () => client.from().select(),
      sortColumn: 'sort',
      idColumn: 'uuid',
      nullableSort: true,
      what: 'rows',
      pageSize: 2,
    });
    const keyed = out.filter((r) => r.sort !== null);
    for (let i = 1; i < keyed.length; i++) {
      const [a, b] = [keyed[i - 1], keyed[i]];
      expect(
        (a.sort as number) < (b.sort as number) ||
          (a.sort === b.sort && (a.uuid as string) < (b.uuid as string)),
      ).toBe(true);
    }
  });

  it('pages on the id alone when there is no sort', async () => {
    const client = table(rows);
    const out = await readKeyset<Row>({
      build: () => client.from().select(),
      idColumn: 'uuid',
      what: 'rows',
      pageSize: 4,
    });
    expect(out.map((r) => r.uuid)).toEqual(
      rows.map((r) => r.uuid as string).sort(),
    );
  });

  it('throws on a read error rather than returning a partial result', async () => {
    const failing = {
      or: () => failing,
      order: () => failing,
      limit: () => failing,
      then: (resolve: (r: unknown) => void) =>
        resolve({ data: null, error: { message: 'boom' } }),
    };
    await expect(
      readKeyset({ build: () => failing, idColumn: 'uuid', what: 'rows' }),
    ).rejects.toThrow(/Failed reading draft rows.*boom/);
  });
});

describe('readByIn', () => {
  it('batches uuid lists and reads every match', async () => {
    const many: Row[] = Array.from({ length: 400 }, (_, i) => ({
      uuid: `a-${String(i).padStart(3, '0')}`,
      passage_uuid: `p-${String(i % 320).padStart(3, '0')}`,
    }));
    const client = table(many);
    const values = Array.from(
      { length: 320 },
      (_, i) => `p-${String(i).padStart(3, '0')}`,
    );
    const out = await readByIn<Row>({
      client: client as never,
      table: 'passage_annotations',
      columns: '*',
      column: 'passage_uuid',
      values,
      idColumn: 'uuid',
      what: 'annotations',
    });
    expect(out).toHaveLength(400);
    expect(Math.max(...client.log.inSizes)).toBeLessThanOrEqual(150);
  });
});
