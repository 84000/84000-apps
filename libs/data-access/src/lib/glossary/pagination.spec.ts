import {
  getGlossaryTermPassagesPage,
  getGlossaryTermPassagesPages,
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
 * A client shaped for the batched RPC. The fake records the call arguments,
 * because the property worth protecting is that a page of terms costs one call
 * with one page-size-plus-one limit — not the row plumbing.
 */
type RpcFakeState = {
  calls: { fn: string; args: Record<string, unknown> }[];
  error?: { message: string };
};

const makeRpcClient = ({
  rowsByTerm,
  state,
}: {
  rowsByTerm: Record<string, { uuid: string; sort: number }[]>;
  state: RpcFakeState;
}) =>
  ({
    rpc: (fn: string, args: Record<string, unknown>) => {
      state.calls.push({ fn, args });
      if (state.error) {
        return Promise.resolve({ data: null, error: state.error });
      }
      const limit = args['p_limit'] as number;
      const offset = args['p_offset'] as number;
      const data = (args['p_term_uuids'] as string[]).flatMap((termUuid) =>
        [...(rowsByTerm[termUuid] ?? [])]
          .sort((a, b) => a.sort - b.sort)
          .slice(offset, offset + limit)
          .map((row) => ({
            term_uuid: termUuid,
            ...row,
            content: null,
            label: null,
            type: 'passage',
          })),
      );
      return Promise.resolve({ data, error: null });
    },
  }) as never;

describe('getGlossaryTermPassagesPages', () => {
  const makeRows = (count: number, prefix: string) =>
    Array.from({ length: count }, (_, i) => ({
      uuid: `${prefix}-${String(i).padStart(3, '0')}`,
      // Descending sort against ascending uuid, so a test that passes by
      // accident of uuid ordering fails here.
      sort: count - i,
    }));

  it('resolves a whole page of terms in one call', async () => {
    const state: RpcFakeState = { calls: [] };
    const uuids = Array.from({ length: 50 }, (_, i) => `term-${i}`);
    const client = makeRpcClient({
      rowsByTerm: Object.fromEntries(
        uuids.map((uuid) => [uuid, makeRows(5, uuid)]),
      ),
      state,
    });

    const pages = await getGlossaryTermPassagesPages({
      client,
      uuids,
      first: 10,
    });

    expect(state.calls).toHaveLength(1);
    expect(state.calls[0].args['p_term_uuids']).toHaveLength(50);
    expect(pages.size).toBe(50);
  });

  it('asks for one row past the page so a next page is detectable', async () => {
    const state: RpcFakeState = { calls: [] };
    const client = makeRpcClient({
      rowsByTerm: { 'term-1': makeRows(5, 'p') },
      state,
    });

    await getGlossaryTermPassagesPages({
      client,
      uuids: ['term-1'],
      first: 2,
      after: '3',
    });

    expect(state.calls[0].args['p_limit']).toBe(3);
    expect(state.calls[0].args['p_offset']).toBe(3);
  });

  it('selects the published function for the published source', async () => {
    const state: RpcFakeState = { calls: [] };
    const client = makeRpcClient({ rowsByTerm: {}, state });

    await getGlossaryTermPassagesPages({
      client,
      uuids: ['term-1'],
      source: 'published',
    });

    expect(state.calls[0].fn).toBe('get_glossary_term_passages_published');
  });

  it('keys pages by term and orders each by sort', async () => {
    const state: RpcFakeState = { calls: [] };
    const client = makeRpcClient({
      rowsByTerm: { a: makeRows(3, 'a'), b: makeRows(2, 'b') },
      state,
    });

    const pages = await getGlossaryTermPassagesPages({
      client,
      uuids: ['a', 'b'],
      first: 10,
    });

    expect(pages.get('a')?.items.map((item) => item.uuid)).toEqual([
      'a-002',
      'a-001',
      'a-000',
    ]);
    expect(pages.get('b')?.items.map((item) => item.uuid)).toEqual([
      'b-001',
      'b-000',
    ]);
  });

  it('reports hasMore and a cursor per term independently', async () => {
    const state: RpcFakeState = { calls: [] };
    const client = makeRpcClient({
      rowsByTerm: { many: makeRows(5, 'm'), few: makeRows(1, 'f') },
      state,
    });

    const pages = await getGlossaryTermPassagesPages({
      client,
      uuids: ['many', 'few'],
      first: 2,
    });

    expect(pages.get('many')).toMatchObject({ hasMore: true, nextCursor: '2' });
    expect(pages.get('few')).toMatchObject({
      hasMore: false,
      nextCursor: null,
    });
    expect(pages.get('many')?.items).toHaveLength(2);
  });

  it('omits terms with no citing passages rather than erroring', async () => {
    const state: RpcFakeState = { calls: [] };
    const client = makeRpcClient({
      rowsByTerm: { cited: makeRows(1, 'c') },
      state,
    });

    const pages = await getGlossaryTermPassagesPages({
      client,
      uuids: ['cited', 'uncited'],
    });

    expect(pages.has('cited')).toBe(true);
    expect(pages.has('uncited')).toBe(false);
  });

  it('drops falsy uuids and issues no call when none remain', async () => {
    // `JSON.stringify` drops undefined, so an empty uuid would reach the
    // function as a null element and match nothing useful.
    const state: RpcFakeState = { calls: [] };
    const client = makeRpcClient({ rowsByTerm: {}, state });

    const pages = await getGlossaryTermPassagesPages({
      client,
      uuids: ['', undefined as unknown as string],
    });

    expect(pages.size).toBe(0);
    expect(state.calls).toHaveLength(0);
  });

  it('returns no pages rather than partial ones on error', async () => {
    const state: RpcFakeState = { calls: [], error: { message: 'boom' } };
    const client = makeRpcClient({
      rowsByTerm: { 'term-1': makeRows(3, 'p') },
      state,
    });

    const pages = await getGlossaryTermPassagesPages({
      client,
      uuids: ['term-1'],
    });

    expect(pages.size).toBe(0);
  });
});

describe('getGlossaryTermPassagesPage', () => {
  it('returns the single term page', async () => {
    const state: RpcFakeState = { calls: [] };
    const client = makeRpcClient({
      rowsByTerm: {
        'term-1': [
          { uuid: 'p-1', sort: 2 },
          { uuid: 'p-0', sort: 1 },
        ],
      },
      state,
    });

    const page = await getGlossaryTermPassagesPage({
      client,
      uuid: 'term-1',
      first: 10,
    });

    expect(page.items.map((item) => item.uuid)).toEqual(['p-0', 'p-1']);
  });

  it('returns an empty page for an uncited term', async () => {
    const state: RpcFakeState = { calls: [] };
    const client = makeRpcClient({ rowsByTerm: {}, state });

    const page = await getGlossaryTermPassagesPage({ client, uuid: 'term-1' });

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
  });
});
