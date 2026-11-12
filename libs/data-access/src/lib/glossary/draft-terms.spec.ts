import {
  getWorkGlossaryTermsAround,
  getWorkGlossaryTermsPage,
} from './pagination';

/**
 * DEV-881 acceptance: for the draft source, `getWorkGlossaryTermsPage` and
 * `getWorkGlossaryTermsAround` read one page through the `glossary_terms_page` RPC (no
 * relation), and return the same GlossaryTermConnection (nodes, pageInfo, totalCount) a
 * caller gets today for the same data. The published source is unchanged.
 *
 * "Today" is pinned by the published path, which still reads `published_glossaries_live`
 * with several queries. Each case builds the same rows behind two fake clients, one per
 * source, and expects equal connections. The RPC fake implements the settled contract of
 * `glossary_terms_page`, so these specs stay independent of how data-access builds the call.
 */

type TermRow = {
  glossary_uuid: string;
  authority_uuid: string;
  work_uuid: string;
  term_number: number;
  definition: string | null;
  english: string | null;
  wylie: string | null;
  tibetan: string | null;
  sanskrit_plain: string | null;
  sanskrit_attested: string | null;
  chinese: string | null;
  pali: string | null;
  alternatives: string | null;
};

const makeRows = (work: string, n: number): TermRow[] =>
  Array.from({ length: n }, (_, i) => {
    const t = i + 1;
    return {
      glossary_uuid: `${work}-g-${t}`,
      authority_uuid: `${work}-a-${t}`,
      work_uuid: work,
      term_number: t,
      definition: `definition ${t}`,
      english: `english ${t}`,
      wylie: `wylie ${t}`,
      tibetan: `tibetan ${t}`,
      sanskrit_plain: `sanskrit ${t}`,
      sanskrit_attested: `sanskrit* ${t}`,
      chinese: `chinese ${t}`,
      pali: `pali ${t}`,
      alternatives: null,
    };
  });

const ROWS: TermRow[] = [
  ...makeRows('work-1', 30),
  ...makeRows('work-2', 7), // another work's terms must never leak in
];

// ---------------------------------------------------------------- the published path (today)

type QueryResult = { data?: unknown[]; count?: number | null; error: null };

/** Minimal PostgREST-like builder over the rows, as used by the published relation. */
class FakeRelationQuery {
  private filters: Array<{ column: string; value: unknown }> = [];
  private greaterThan?: number;
  private lessThan?: number;
  private ascending = true;
  private limitValue?: number;
  private head = false;
  private columns = '';

  constructor(private readonly rows: TermRow[]) {}

  select(columns: string, options?: { head?: boolean }) {
    this.columns = columns;
    this.head = options?.head ?? false;
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }
  gt(_c: string, v: number) {
    this.greaterThan = v;
    return this;
  }
  lt(_c: string, v: number) {
    this.lessThan = v;
    return this;
  }
  gte(_c: string, v: number) {
    this.greaterThan = v - 1;
    return this;
  }
  lte(_c: string, v: number) {
    this.lessThan = v + 1;
    return this;
  }
  order(_c: string, o: { ascending: boolean }) {
    this.ascending = o.ascending;
    return this;
  }
  limit(v: number) {
    this.limitValue = v;
    return this;
  }
  then<T1 = QueryResult, T2 = never>(
    ok?: ((v: QueryResult) => T1 | PromiseLike<T1>) | null,
    bad?: ((r: unknown) => T2 | PromiseLike<T2>) | null,
  ) {
    return Promise.resolve(this.execute()).then(ok, bad);
  }

  private execute(): QueryResult {
    let data = this.rows.filter((row) =>
      this.filters.every(
        (f) => row[f.column as keyof TermRow] === (f.value as never),
      ),
    );
    if (this.greaterThan !== undefined)
      data = data.filter((r) => r.term_number > this.greaterThan!);
    if (this.lessThan !== undefined)
      data = data.filter((r) => r.term_number < this.lessThan!);
    data = [...data].sort((a, b) =>
      this.ascending
        ? a.term_number - b.term_number
        : b.term_number - a.term_number,
    );
    if (this.limitValue !== undefined) data = data.slice(0, this.limitValue);
    if (this.head) return { count: data.length, error: null };
    if (
      this.columns.includes('term_number') &&
      this.columns.includes('glossary_uuid') &&
      !this.columns.includes('definition')
    ) {
      return {
        data: data.map(({ glossary_uuid, term_number }) => ({
          glossary_uuid,
          term_number,
        })),
        error: null,
      };
    }
    return { data, error: null };
  }
}

const publishedClient = (rows: TermRow[]) =>
  ({
    from: (table: string) => {
      if (table !== 'published_glossaries_live') {
        throw new Error(
          `unexpected relation for the published source: ${table}`,
        );
      }
      return new FakeRelationQuery(rows);
    },
    rpc: () => {
      throw new Error('the published source must not call an rpc for pages');
    },
  }) as never;

// ---------------------------------------------------------------- the draft path (contract)

type RpcCall = { fn: string; args: Record<string, unknown> };

const jsonBuilder = (result: { data: unknown; error: unknown }) => {
  const builder: Record<string, unknown> = {
    then: (ok: (v: unknown) => unknown, bad: (r: unknown) => unknown) =>
      Promise.resolve(result).then(ok, bad),
  };
  for (const m of ['select', 'limit', 'eq', 'order'])
    builder[m] = () => builder;
  builder['single'] = () => Promise.resolve(result);
  builder['maybeSingle'] = () => Promise.resolve(result);
  return builder;
};

/** `glossary_terms_page` as the contract describes it. */
const termsPage = (rows: TermRow[], args: Record<string, unknown>) => {
  const work = rows
    .filter((r) => r.work_uuid === args['p_work_uuid'])
    .sort((a, b) => a.term_number - b.term_number);
  const total = work.length;
  const limit = Math.min(
    Math.max(Math.trunc(Number(args['p_limit'] ?? 50)), 1),
    200,
  );
  const direction = String(args['p_direction'] ?? 'FORWARD');
  const cursor = (args['p_cursor'] as string | null | undefined) ?? null;
  const slice = (from: number, to: number) =>
    work.filter((r) => r.term_number >= from && r.term_number <= to);

  if (cursor === null) {
    return {
      total_count: total,
      cursor_term_number: null,
      terms: slice(1, limit),
    };
  }
  const found = work.find((r) => r.glossary_uuid === cursor);
  if (!found) {
    return { total_count: total, cursor_term_number: null, terms: [] };
  }
  const c = found.term_number;
  let terms: TermRow[];
  if (direction === 'BACKWARD') {
    terms = slice(Math.max(1, c - limit), c - 1);
  } else if (direction === 'AROUND') {
    let start = Math.max(1, c - Math.floor(limit / 2));
    let end = start + limit - 1;
    if (end > total) {
      end = total;
      start = Math.max(1, end - limit + 1);
    }
    terms = slice(start, end);
  } else {
    terms = slice(c + 1, c + limit);
  }
  return { total_count: total, cursor_term_number: c, terms };
};

const draftClient = (
  rows: TermRow[],
  calls: RpcCall[] = [],
  fromCalls: string[] = [],
) =>
  ({
    from: (table: string) => {
      fromCalls.push(table);
      return jsonBuilder({ data: [], error: null });
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fn !== 'glossary_terms_page') {
        return jsonBuilder({
          data: null,
          error: { message: `unexpected rpc ${fn}` },
        });
      }
      return jsonBuilder({ data: termsPage(rows, args), error: null });
    },
  }) as never;

const quiet = () =>
  jest.spyOn(console, 'error').mockImplementation(() => undefined);

// ---------------------------------------------------------------- cases

describe('draft source: one page call, no relation', () => {
  it('reads a first page through glossary_terms_page and touches no relation', async () => {
    const calls: RpcCall[] = [];
    const fromCalls: string[] = [];
    const result = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS, calls, fromCalls),
      workUuid: 'work-1',
      limit: 5,
      source: 'draft',
    });

    expect(fromCalls).toEqual([]);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.every((c) => c.fn === 'glossary_terms_page')).toBe(true);
    expect(calls[0].args).toMatchObject({ p_work_uuid: 'work-1' });
    expect(result.nodes.map((n) => n.termNumber)).toEqual([1, 2, 3, 4, 5]);
    expect(result.totalCount).toBe(30);
  });

  it('maps a row to the node shape callers get today', async () => {
    const result = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      limit: 1,
      source: 'draft',
    });
    expect(result.nodes).toEqual([
      {
        uuid: 'work-1-g-1',
        authority: 'work-1-a-1',
        definition: 'definition 1',
        termNumber: 1,
        names: {
          english: 'english 1',
          alternatives: null,
          wylie: 'wylie 1',
          tibetan: 'tibetan 1',
          sanskrit: 'sanskrit 1',
          chinese: 'chinese 1',
          pali: 'pali 1',
        },
      },
    ]);
  });

  it('carries alternatives through', async () => {
    const rows = makeRows('work-1', 3).map((r) => ({
      ...r,
      alternatives: 'alt',
    }));
    const result = await getWorkGlossaryTermsPage({
      client: draftClient(rows),
      workUuid: 'work-1',
      source: 'draft',
    });
    expect(result.nodes.map((n) => n.names.alternatives)).toEqual([
      'alt',
      'alt',
      'alt',
    ]);
  });

  it('uses the attested Sanskrit only when asked', async () => {
    const plain = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      limit: 2,
      withAttestations: false,
      source: 'draft',
    });
    const attested = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      limit: 2,
      withAttestations: true,
      source: 'draft',
    });
    expect(plain.nodes.map((n) => n.names.sanskrit)).toEqual([
      'sanskrit 1',
      'sanskrit 2',
    ]);
    expect(attested.nodes.map((n) => n.names.sanskrit)).toEqual([
      'sanskrit* 1',
      'sanskrit* 2',
    ]);
  });

  it('uses glossary uuids as cursors and reports page info', async () => {
    const result = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      cursor: 'work-1-g-5',
      limit: 5,
      direction: 'FORWARD',
      source: 'draft',
    });
    expect(result.nodes.map((n) => n.termNumber)).toEqual([6, 7, 8, 9, 10]);
    expect(result.pageInfo).toEqual({
      nextCursor: 'work-1-g-10',
      prevCursor: 'work-1-g-6',
      hasMoreAfter: true,
      hasMoreBefore: true,
    });
    expect(result.totalCount).toBe(30);
  });

  it('returns pages BACKWARD in ascending order', async () => {
    const result = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      cursor: 'work-1-g-11',
      limit: 5,
      direction: 'BACKWARD',
      source: 'draft',
    });
    expect(result.nodes.map((n) => n.termNumber)).toEqual([6, 7, 8, 9, 10]);
    expect(result.pageInfo.prevCursor).toBe('work-1-g-6');
    expect(result.pageInfo.nextCursor).toBe('work-1-g-10');
  });

  it('pages around a cursor with the same window rule as today', async () => {
    const mid = await getWorkGlossaryTermsAround({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      limit: 10,
      cursor: 'work-1-g-15',
      withAttestations: false,
      source: 'draft',
    });
    expect(mid.nodes.map((n) => n.termNumber)).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
    expect(mid.pageInfo).toEqual({
      nextCursor: 'work-1-g-19',
      prevCursor: 'work-1-g-10',
      hasMoreAfter: true,
      hasMoreBefore: true,
    });

    const end = await getWorkGlossaryTermsAround({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      limit: 10,
      cursor: 'work-1-g-29',
      withAttestations: false,
      source: 'draft',
    });
    expect(end.nodes.map((n) => n.termNumber)).toEqual([
      21, 22, 23, 24, 25, 26, 27, 28, 29, 30,
    ]);
    expect(end.pageInfo.hasMoreAfter).toBe(false);
    expect(end.pageInfo.nextCursor).toBeNull();
    expect(end.pageInfo.hasMoreBefore).toBe(true);
  });

  it('routes direction AROUND through the page function the same way', async () => {
    const viaPage = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      limit: 10,
      cursor: 'work-1-g-15',
      direction: 'AROUND',
      source: 'draft',
    });
    expect(viaPage.nodes.map((n) => n.termNumber)).toEqual([
      10, 11, 12, 13, 14, 15, 16, 17, 18, 19,
    ]);
  });

  it('returns an empty connection with the total for a cursor outside the work', async () => {
    const result = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS),
      workUuid: 'work-1',
      cursor: 'work-2-g-1', // belongs to another work
      limit: 5,
      direction: 'FORWARD',
      source: 'draft',
    });
    expect(result).toEqual({
      nodes: [],
      pageInfo: {
        nextCursor: null,
        prevCursor: null,
        hasMoreAfter: false,
        hasMoreBefore: false,
      },
      totalCount: 30,
    });
  });

  it('returns an empty connection for a work with no terms', async () => {
    const result = await getWorkGlossaryTermsPage({
      client: draftClient(ROWS),
      workUuid: 'work-none',
      source: 'draft',
    });
    expect(result).toEqual({
      nodes: [],
      pageInfo: {
        nextCursor: null,
        prevCursor: null,
        hasMoreAfter: false,
        hasMoreBefore: false,
      },
      totalCount: 0,
    });
  });

  it('clamps the page size to 1..200', async () => {
    const big = makeRows('work-big', 250);
    const many = await getWorkGlossaryTermsPage({
      client: draftClient(big),
      workUuid: 'work-big',
      limit: 1000,
      source: 'draft',
    });
    expect(many.nodes).toHaveLength(200);
    expect(many.totalCount).toBe(250);
    expect(many.pageInfo.hasMoreAfter).toBe(true);

    const one = await getWorkGlossaryTermsPage({
      client: draftClient(big),
      workUuid: 'work-big',
      limit: 0,
      source: 'draft',
    });
    expect(one.nodes).toHaveLength(1);
  });

  it('returns an empty connection, without throwing, when the call fails', async () => {
    const spy = quiet();
    const failing = {
      from: () => jsonBuilder({ data: [], error: null }),
      rpc: () =>
        jsonBuilder({ data: null, error: { message: 'boom', code: 'XX000' } }),
    } as never;

    const page = await getWorkGlossaryTermsPage({
      client: failing,
      workUuid: 'work-1',
      source: 'draft',
    });
    const around = await getWorkGlossaryTermsAround({
      client: failing,
      workUuid: 'work-1',
      limit: 10,
      cursor: 'work-1-g-3',
      withAttestations: false,
      source: 'draft',
    });
    spy.mockRestore();

    for (const result of [page, around]) {
      expect(result.nodes).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.pageInfo.nextCursor).toBeNull();
    }
  });
});

describe('draft source matches the published path for the same data', () => {
  const cursors: Array<[string, string | null]> = [
    ['no cursor', null],
    ['first term', 'work-1-g-1'],
    ['a middle term', 'work-1-g-14'],
    ['the last term', 'work-1-g-30'],
    ['a uuid outside the work', 'nope'],
  ];
  const limits = [1, 5, 10, 29, 30, 50, 0, 1000];

  // BACKWARD with no cursor is deliberately not compared: today it returns the last page,
  // while the settled glossary_terms_page contract returns the first. See the report.
  const cases = (['FORWARD', 'BACKWARD', 'AROUND'] as const).flatMap(
    (direction) =>
      cursors
        .filter(([, cursor]) => !(direction === 'BACKWARD' && cursor === null))
        .flatMap(([label, cursor]) =>
          limits.map((limit) => ({ direction, label, cursor, limit })),
        ),
  );

  it.each(cases)(
    '$direction, $label, limit $limit',
    async ({ direction, cursor, limit }) => {
      const args = {
        workUuid: 'work-1',
        limit,
        cursor,
        direction,
        withAttestations: false,
      };
      const today = await getWorkGlossaryTermsPage({
        ...args,
        client: publishedClient(ROWS),
        source: 'published',
      });
      const draft = await getWorkGlossaryTermsPage({
        ...args,
        client: draftClient(ROWS),
        source: 'draft',
      });
      expect(draft).toEqual(today);
    },
  );

  it.each([
    ['no cursor', null],
    ['a middle term', 'work-1-g-14'],
    ['the last term', 'work-1-g-30'],
    ['a uuid outside the work', 'nope'],
  ] as Array<[string, string | null]>)(
    'getWorkGlossaryTermsAround with %s',
    async (_label, cursor) => {
      const args = {
        workUuid: 'work-1',
        limit: 10,
        cursor,
        withAttestations: true,
      };
      const today = await getWorkGlossaryTermsAround({
        ...args,
        client: publishedClient(ROWS),
        source: 'published',
      });
      const draft = await getWorkGlossaryTermsAround({
        ...args,
        client: draftClient(ROWS),
        source: 'draft',
      });
      expect(draft).toEqual(today);
    },
  );
});

describe('published source is unchanged', () => {
  it('still reads published_glossaries_live and never calls glossary_terms_page', async () => {
    const seen: string[] = [];
    const rpcs: string[] = [];
    const client = {
      from: (table: string) => {
        seen.push(table);
        return new FakeRelationQuery(ROWS);
      },
      rpc: (fn: string) => {
        rpcs.push(fn);
        return jsonBuilder({ data: null, error: { message: 'unexpected' } });
      },
    } as never;

    const page = await getWorkGlossaryTermsPage({
      client,
      workUuid: 'work-1',
      limit: 3,
      cursor: 'work-1-g-2',
      source: 'published',
    });
    const around = await getWorkGlossaryTermsAround({
      client,
      workUuid: 'work-1',
      limit: 4,
      cursor: 'work-1-g-9',
      withAttestations: false,
      source: 'published',
    });

    expect(rpcs).toEqual([]);
    expect(new Set(seen)).toEqual(new Set(['published_glossaries_live']));
    expect(page.nodes.map((n) => n.termNumber)).toEqual([3, 4, 5]);
    expect(around.nodes.map((n) => n.termNumber)).toEqual([7, 8, 9, 10]);
  });

  it('defaults to the published source when none is given', async () => {
    const seen: string[] = [];
    const client = {
      from: (table: string) => {
        seen.push(table);
        return new FakeRelationQuery(ROWS);
      },
      rpc: () => {
        throw new Error('no rpc expected');
      },
    } as never;
    const page = await getWorkGlossaryTermsPage({
      client,
      workUuid: 'work-1',
      limit: 2,
    });
    expect(new Set(seen)).toEqual(new Set(['published_glossaries_live']));
    expect(page.nodes).toHaveLength(2);
  });
});
