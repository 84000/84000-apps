import {
  getGlossaryTermPassagesPage,
  getWorkGlossaryTermsPage,
  type GlossaryTermIndexRow,
} from './pagination';

type QueryResult = {
  data?: unknown[];
  count?: number | null;
  error: null;
};

type FakeGlossaryTermIndexRow = GlossaryTermIndexRow & {
  work_uuid: string;
};

class FakeGlossaryQuery {
  private selectColumns = '';
  private filters: Array<{ column: string; value: unknown }> = [];
  private greaterThan?: number;
  private lessThan?: number;
  private ascending = true;
  private limitValue?: number;
  private head = false;

  constructor(
    private readonly rows: FakeGlossaryTermIndexRow[],
    private readonly queries: FakeGlossaryQuery[],
  ) {
    this.queries.push(this);
  }

  select(columns: string, options?: { count?: string; head?: boolean }) {
    this.selectColumns = columns;
    this.head = options?.head ?? false;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  gt(_column: string, value: number) {
    this.greaterThan = value;
    return this;
  }

  lt(_column: string, value: number) {
    this.lessThan = value;
    return this;
  }

  gte(_column: string, value: number) {
    this.greaterThan = value - 1;
    return this;
  }

  lte(_column: string, value: number) {
    this.lessThan = value + 1;
    return this;
  }

  order(_column: string, options: { ascending: boolean }) {
    this.ascending = options.ascending;
    return this;
  }

  limit(value: number) {
    this.limitValue = value;
    return this;
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?:
      | ((value: QueryResult) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }

  hasFilter(column: string, value: unknown) {
    return this.filters.some(
      (filter) => filter.column === column && filter.value === value,
    );
  }

  private execute(): QueryResult {
    const workUuid = this.filters.find(
      (filter) => filter.column === 'work_uuid',
    )?.value;
    let data = this.rows.filter((row) => row.work_uuid === workUuid);

    for (const filter of this.filters) {
      if (filter.column === 'work_uuid') continue;
      data = data.filter(
        (row) =>
          row[filter.column as keyof FakeGlossaryTermIndexRow] === filter.value,
      );
    }

    if (this.greaterThan !== undefined) {
      data = data.filter((row) => Number(row.term_number) > this.greaterThan!);
    }

    if (this.lessThan !== undefined) {
      data = data.filter((row) => Number(row.term_number) < this.lessThan!);
    }

    data = [...data].sort((a, b) => {
      const delta = Number(a.term_number) - Number(b.term_number);
      return this.ascending ? delta : -delta;
    });

    if (this.limitValue !== undefined) {
      data = data.slice(0, this.limitValue);
    }

    return this.head
      ? { count: data.length, error: null }
      : { data: this.projectRows(data), error: null };
  }

  private projectRows(data: FakeGlossaryTermIndexRow[]) {
    if (!this.selectColumns.includes('term_number')) {
      return data;
    }

    if (
      this.selectColumns.includes('glossary_uuid') &&
      !this.selectColumns.includes('definition')
    ) {
      return data.map(({ glossary_uuid, term_number }) => ({
        glossary_uuid,
        term_number,
      }));
    }

    return data;
  }
}

const createRow = ({
  glossaryUuid,
  authorityUuid,
  termNumber,
}: {
  glossaryUuid: string;
  authorityUuid: string;
  termNumber: number;
}): FakeGlossaryTermIndexRow =>
  ({
    glossary_uuid: glossaryUuid,
    authority_uuid: authorityUuid,
    term_number: termNumber,
    definition: null,
    english: `Term ${termNumber}`,
    wylie: null,
    tibetan: null,
    sanskrit_plain: null,
    sanskrit_attested: null,
    chinese: null,
    pali: null,
    alternatives: null,
    work_uuid: 'work-1',
  }) as FakeGlossaryTermIndexRow;

const createClient = (rows: FakeGlossaryTermIndexRow[]) => {
  const queries: FakeGlossaryQuery[] = [];
  return {
    queries,
    client: {
      from: () => new FakeGlossaryQuery(rows, queries),
    } as never,
  };
};

describe('getWorkGlossaryTermsPage', () => {
  it('uses glossary UUIDs for forward pagination cursors', async () => {
    const { client, queries } = createClient([
      createRow({
        glossaryUuid: 'glossary-1',
        authorityUuid: 'authority-a',
        termNumber: 1,
      }),
      createRow({
        glossaryUuid: 'glossary-2',
        authorityUuid: 'authority-a',
        termNumber: 2,
      }),
      createRow({
        glossaryUuid: 'glossary-3',
        authorityUuid: 'authority-b',
        termNumber: 3,
      }),
    ]);

    const result = await getWorkGlossaryTermsPage({
      client,
      workUuid: 'work-1',
      cursor: 'glossary-1',
      limit: 1,
      direction: 'FORWARD',
      withAttestations: false,
    });

    expect(
      queries.some((query) => query.hasFilter('glossary_uuid', 'glossary-1')),
    ).toBe(true);
    expect(
      queries.some((query) => query.hasFilter('authority_uuid', 'glossary-1')),
    ).toBe(false);
    expect(result.nodes.map((node) => node.uuid)).toEqual(['glossary-2']);
    expect(result.pageInfo.nextCursor).toBe('glossary-2');
    expect(result.pageInfo.prevCursor).toBe('glossary-2');
  });
});

/**
 * A client shaped for `getGlossaryTermPassagesPage`, which issues exactly one
 * request. The fake records what that request asked for, because the shape of
 * the query — one embedded inner join rather than a walk over uuids — is the
 * thing worth protecting.
 */
type PassagesFakeState = {
  requests: number;
  selects: string[];
  eqFilters: [string, unknown][];
  containmentFilters: [string, string][];
  orders: [string, boolean][];
  ranges: [number, number][];
  error?: { message: string };
};

const makePassagesClient = ({
  rows,
  state,
}: {
  rows: { uuid: string; sort: number }[];
  state: PassagesFakeState;
}) => {
  class Query {
    select(columns: string) {
      state.requests++;
      state.selects.push(columns);
      return this;
    }
    eq(column: string, value: unknown) {
      state.eqFilters.push([column, value]);
      return this;
    }
    filter(column: string, _op: string, value: string) {
      state.containmentFilters.push([column, value]);
      return this;
    }
    order(column: string, opts?: { ascending?: boolean }) {
      state.orders.push([column, opts?.ascending ?? true]);
      return this;
    }
    range(from: number, to: number) {
      state.ranges.push([from, to]);
      if (state.error) {
        return Promise.resolve({ data: null, error: state.error });
      }
      // Ordered by sort, as the database would return it, with the embedded
      // join marker the real response carries.
      const ordered = [...rows].sort((a, b) => a.sort - b.sort);
      return Promise.resolve({
        data: ordered.slice(from, to + 1).map((row) => ({
          ...row,
          content: null,
          label: null,
          type: 'passage',
          glossaryInstances: [{ passage_uuid: row.uuid }],
        })),
        error: null,
      });
    }
  }

  return { from: () => new Query() } as never;
};

describe('getGlossaryTermPassagesPage', () => {
  const emptyState = (): PassagesFakeState => ({
    requests: 0,
    selects: [],
    eqFilters: [],
    containmentFilters: [],
    orders: [],
    ranges: [],
  });

  const makeRows = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      uuid: `passage-${String(i).padStart(5, '0')}`,
      // Descending sort against ascending uuid, so a test that passes by
      // accident of uuid ordering fails here.
      sort: count - i,
    }));

  it('reads the page in a single request', async () => {
    const state = emptyState();
    const client = makePassagesClient({ rows: makeRows(50), state });

    await getGlossaryTermPassagesPage({ client, uuid: 'term-1', first: 10 });

    expect(state.requests).toBe(1);
  });

  it('joins the annotations relation inner, scoped to the term', async () => {
    const state = emptyState();
    const client = makePassagesClient({ rows: makeRows(5), state });

    await getGlossaryTermPassagesPage({ client, uuid: 'term-1', first: 10 });

    // `!inner` is what turns the embed into a join and applies the filters; a
    // plain embed would return every passage instead.
    expect(state.selects[0]).toContain('!inner(passage_uuid)');
    expect(state.eqFilters).toEqual([
      ['glossaryInstances.type', 'glossary-instance'],
    ]);
    expect(state.containmentFilters).toEqual([
      ['glossaryInstances.content', '[{"uuid":"term-1"}]'],
    ]);
    // `sort` lives on passages, so ordering is native rather than reconstructed.
    expect(state.orders).toEqual([['sort', true]]);
  });

  it('orders by sort and returns the requested slice', async () => {
    const state = emptyState();
    const client = makePassagesClient({ rows: makeRows(5), state });

    const page = await getGlossaryTermPassagesPage({
      client,
      uuid: 'term-1',
      first: 2,
    });

    expect(page.items.map((item) => item.uuid)).toEqual([
      'passage-00004',
      'passage-00003',
    ]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('2');
  });

  it('asks for one row past the page to detect a next page', async () => {
    const state = emptyState();
    const client = makePassagesClient({ rows: makeRows(5), state });

    await getGlossaryTermPassagesPage({ client, uuid: 'term-1', first: 2 });

    expect(state.ranges).toEqual([[0, 2]]);
  });

  it('continues from a cursor and reports the final page', async () => {
    const state = emptyState();
    const client = makePassagesClient({ rows: makeRows(5), state });

    const page = await getGlossaryTermPassagesPage({
      client,
      uuid: 'term-1',
      first: 2,
      after: '3',
    });

    // 5 passages, offset 3, limit 2 — the last two, and no further page.
    expect(state.ranges).toEqual([[3, 5]]);
    expect(page.items.map((item) => item.uuid)).toEqual([
      'passage-00001',
      'passage-00000',
    ]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('strips the join marker from returned passages', async () => {
    const state = emptyState();
    const client = makePassagesClient({ rows: makeRows(2), state });

    const page = await getGlossaryTermPassagesPage({ client, uuid: 'term-1' });

    for (const item of page.items) {
      expect(item).not.toHaveProperty('glossaryInstances');
    }
    expect(page.items[0].uuid).toBe('passage-00001');
  });

  it('refuses to run an unbounded containment scan for a falsy uuid', async () => {
    // `JSON.stringify([{ uuid: undefined }])` is `[{}]`, and `content @> '[{}]'`
    // matches every annotation with a non-empty array — a full-table scan that
    // trips the statement timeout. The query must never be issued.
    const state = emptyState();
    const client = makePassagesClient({ rows: makeRows(10), state });

    for (const uuid of ['', undefined as unknown as string]) {
      const page = await getGlossaryTermPassagesPage({ client, uuid });
      expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
    }

    expect(state.requests).toBe(0);
  });

  it('returns empty rather than a partial page on error', async () => {
    const state = { ...emptyState(), error: { message: 'boom' } };
    const client = makePassagesClient({ rows: makeRows(10), state });

    const page = await getGlossaryTermPassagesPage({ client, uuid: 'term-1' });

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
  });
});
