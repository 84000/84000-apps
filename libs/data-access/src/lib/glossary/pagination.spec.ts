import {
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
}): FakeGlossaryTermIndexRow => ({
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
