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
 * A client shaped for `getGlossaryTermPassagesPage`. The two reads it makes hit
 * different relations, so this dispatches on relation name and records what
 * each read was handed — the batch sizes are the point of most of these tests.
 */
type PassagesFakeState = {
  /** One entry per `.in('uuid', […])` on the light `(uuid, sort)` read — the
   * one whose URL used to overflow. The final full-columns read is recorded
   * separately, since it is bounded by the page size, not the citation count. */
  inBatchSizes: number[];
  finalReadSizes: number[];
  /** One entry per `.range()` against the annotations relation. */
  annotationRanges: [number, number][];
  annotationsError?: { message: string };
  passagesError?: { message: string };
};

const makePassagesClient = ({
  annotationRows,
  passageRows,
  state,
}: {
  annotationRows: { uuid: string; passage_uuid: string }[];
  passageRows: { uuid: string; sort: number }[];
  state: PassagesFakeState;
}) => {
  class Query {
    private uuids: string[] | null = null;
    private columns = '';

    constructor(private readonly relation: string) {}

    select(columns?: string) {
      this.columns = columns ?? '';
      return this;
    }
    eq() {
      return this;
    }
    filter() {
      return this;
    }
    order() {
      return this;
    }

    in(_column: string, values: string[]) {
      this.uuids = values;
      if (this.columns === 'uuid, sort') {
        state.inBatchSizes.push(values.length);
      } else {
        state.finalReadSizes.push(values.length);
      }
      return this;
    }

    range(from: number, to: number) {
      state.annotationRanges.push([from, to]);
      if (state.annotationsError) {
        return Promise.resolve({ data: null, error: state.annotationsError });
      }
      return Promise.resolve({
        data: annotationRows.slice(from, to + 1),
        error: null,
      });
    }

    then(resolve: (result: unknown) => unknown) {
      if (this.relation.includes('annotation')) {
        return Promise.resolve({ data: annotationRows, error: null }).then(
          resolve,
        );
      }
      if (state.passagesError) {
        return Promise.resolve({
          data: null,
          error: state.passagesError,
        }).then(resolve);
      }
      const wanted = new Set(this.uuids ?? []);
      const rows = passageRows
        .filter((row) => wanted.has(row.uuid))
        // Deliberately reversed: `.in()` does not preserve argument order, and
        // the implementation must not rely on the order rows come back in.
        .reverse()
        .map((row) => ({
          ...row,
          content: null,
          label: null,
          type: 'passage',
        }));
      return Promise.resolve({ data: rows, error: null }).then(resolve);
    }
  }

  return {
    from: (relation: string) => new Query(relation),
  } as never;
};

describe('getGlossaryTermPassagesPage', () => {
  const makeAnnotations = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      uuid: `annotation-${i}`,
      passage_uuid: `passage-${String(i).padStart(5, '0')}`,
    }));

  const makePassages = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      uuid: `passage-${String(i).padStart(5, '0')}`,
      // Descending sort against ascending uuid, so any test that passes by
      // accident of uuid ordering fails here.
      sort: count - i,
    }));

  it('never sends more than 200 uuids in one `in` filter', async () => {
    const state: PassagesFakeState = {
      inBatchSizes: [],
      finalReadSizes: [],
      annotationRanges: [],
    };
    const client = makePassagesClient({
      annotationRows: makeAnnotations(1500),
      passageRows: makePassages(1500),
      state,
    });

    await getGlossaryTermPassagesPage({ client, uuid: 'term-1', first: 10 });

    expect(state.inBatchSizes.length).toBeGreaterThan(1);
    expect(Math.max(...state.inBatchSizes)).toBeLessThanOrEqual(200);
  });

  it('pages the annotations read past the 1000-row cap', async () => {
    const state: PassagesFakeState = {
      inBatchSizes: [],
      finalReadSizes: [],
      annotationRanges: [],
    };
    const client = makePassagesClient({
      annotationRows: makeAnnotations(2500),
      passageRows: makePassages(2500),
      state,
    });

    await getGlossaryTermPassagesPage({ client, uuid: 'term-1', first: 10 });

    // 1000 + 1000 + 500: the third page is short, which ends the loop.
    expect(state.annotationRanges).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    // All 2500 uuids reached the batched reads, not just the first 1000.
    const totalBatched = state.inBatchSizes.reduce((a, b) => a + b, 0);
    expect(totalBatched).toBe(2500);
  });

  it('orders by sort and returns the requested slice', async () => {
    const state: PassagesFakeState = {
      inBatchSizes: [],
      finalReadSizes: [],
      annotationRanges: [],
    };
    const client = makePassagesClient({
      annotationRows: makeAnnotations(5),
      passageRows: makePassages(5),
      state,
    });

    const page = await getGlossaryTermPassagesPage({
      client,
      uuid: 'term-1',
      first: 2,
    });

    // sort ascending means the highest-numbered passage comes first.
    expect(page.items.map((item) => item.uuid)).toEqual([
      'passage-00004',
      'passage-00003',
    ]);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).toBe('2');
  });

  it('continues from a cursor and reports the final page', async () => {
    const state: PassagesFakeState = {
      inBatchSizes: [],
      finalReadSizes: [],
      annotationRanges: [],
    };
    const client = makePassagesClient({
      annotationRows: makeAnnotations(5),
      passageRows: makePassages(5),
      state,
    });

    const page = await getGlossaryTermPassagesPage({
      client,
      uuid: 'term-1',
      first: 2,
      after: '3',
    });

    // 5 passages, offset 3, limit 2 — the last two, and no further page.
    expect(page.items.map((item) => item.uuid)).toEqual([
      'passage-00001',
      'passage-00000',
    ]);
    expect(page.hasMore).toBe(false);
    expect(page.nextCursor).toBeNull();
  });

  it('deduplicates passages cited more than once by the same term', async () => {
    const state: PassagesFakeState = {
      inBatchSizes: [],
      finalReadSizes: [],
      annotationRanges: [],
    };
    const client = makePassagesClient({
      annotationRows: [
        { uuid: 'a-1', passage_uuid: 'passage-00000' },
        { uuid: 'a-2', passage_uuid: 'passage-00000' },
        { uuid: 'a-3', passage_uuid: 'passage-00001' },
      ],
      passageRows: makePassages(2),
      state,
    });

    const page = await getGlossaryTermPassagesPage({ client, uuid: 'term-1' });

    expect(state.inBatchSizes).toEqual([2]);
    expect(page.items.map((item) => item.uuid)).toEqual([
      'passage-00001',
      'passage-00000',
    ]);
  });

  it('returns empty rather than a partial page when a batch fails', async () => {
    const state: PassagesFakeState = {
      inBatchSizes: [],
      finalReadSizes: [],
      annotationRanges: [],
      passagesError: { message: 'boom' },
    };
    const client = makePassagesClient({
      annotationRows: makeAnnotations(400),
      passageRows: makePassages(400),
      state,
    });

    const page = await getGlossaryTermPassagesPage({ client, uuid: 'term-1' });

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
  });

  it('returns empty when the annotations read fails', async () => {
    const state: PassagesFakeState = {
      inBatchSizes: [],
      finalReadSizes: [],
      annotationRanges: [],
      annotationsError: { message: 'boom' },
    };
    const client = makePassagesClient({
      annotationRows: makeAnnotations(10),
      passageRows: makePassages(10),
      state,
    });

    const page = await getGlossaryTermPassagesPage({ client, uuid: 'term-1' });

    expect(page).toEqual({ items: [], nextCursor: null, hasMore: false });
    expect(state.inBatchSizes).toEqual([]);
  });
});
