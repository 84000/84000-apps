/**
 * Test fixture for the DEV-894 acceptance tests: an in-memory stand-in for the
 * PostgREST client, with failure injection and a write log. Written from the
 * public contract (table names, the `apply_passage_save` and
 * `shift_passage_sorts` rpcs, the `authorize` rpc) and nothing else.
 *
 * Identical copies live beside the data-access and lib-agent acceptance specs.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

export type FailureMode =
  /** Postgres refused the write and rolled it back: a SQLSTATE, nothing written. */
  | 'rolled-back'
  /** The write is applied but the response is lost: an error with no code. */
  | 'lost-response';

export type FailureRule = {
  /** A table name (writes through `from`) or an rpc name. */
  target: string;
  mode: FailureMode;
  /** Let this many matching writes succeed before failing. Default 0. */
  after?: number;
};

export type WriteLogEntry = {
  kind: 'insert' | 'update' | 'upsert' | 'delete' | 'rpc';
  /** The table, or the rpc name. */
  target: string;
};

export type FakeWorld = {
  tables: Tables;
  /** Every write and every rpc other than `authorize`, in call order. */
  writes: WriteLogEntry[];
  /** Every `from(table)` and rpc name the code under test used. */
  calls: string[];
  failures: FailureRule[];
  allowed: boolean;
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const deepEqual = (a: unknown, b: unknown): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

/** JSON containment as Postgres `@>`: every element of `want` is in `have`. */
const contains = (have: unknown, want: unknown): boolean => {
  if (Array.isArray(want)) {
    return (
      Array.isArray(have) &&
      want.every((w) => have.some((h: unknown) => contains(h, w)))
    );
  }
  if (want && typeof want === 'object') {
    return (
      !!have &&
      typeof have === 'object' &&
      Object.entries(want).every(([k, v]) => contains((have as Row)[k], v))
    );
  }
  return have === want;
};

const likeToRegExp = (pattern: string) =>
  new RegExp(
    '^' +
      pattern
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/%/g, '.*')
        .replace(/_/g, '.') +
      '$',
  );

type Result = {
  data: unknown;
  error: { message: string; code?: string } | null;
};

class FakeQuery implements PromiseLike<Result> {
  private action: 'select' | 'insert' | 'update' | 'upsert' | 'delete' =
    'select';
  private payload: Row | Row[] | null = null;
  private filters: ((row: Row) => boolean)[] = [];
  private orders: { column: string; ascending: boolean }[] = [];
  private from_ = 0;
  private to_ = Infinity;
  private limit_ = Infinity;
  private returning = false;
  private one: 'single' | 'maybe' | null = null;

  constructor(
    private readonly world: FakeWorld,
    private readonly table: string,
  ) {}

  select() {
    if (this.action !== 'select') this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.action = 'insert';
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.action = 'update';
    this.payload = patch;
    return this;
  }
  upsert(rows: Row | Row[]) {
    this.action = 'upsert';
    this.payload = rows;
    return this;
  }
  delete() {
    this.action = 'delete';
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => deepEqual(row[column], value));
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((row) => !deepEqual(row[column], value));
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push((row) =>
      value === null ? row[column] == null : row[column] === value,
    );
    return this;
  }
  like(column: string, pattern: string) {
    const re = likeToRegExp(pattern);
    this.filters.push((row) => re.test(String(row[column])));
    return this;
  }
  gt(column: string, value: number) {
    this.filters.push((row) => (row[column] as number) > value);
    return this;
  }
  gte(column: string, value: number) {
    this.filters.push((row) => (row[column] as number) >= value);
    return this;
  }
  lt(column: string, value: number) {
    this.filters.push((row) => (row[column] as number) < value);
    return this;
  }
  lte(column: string, value: number) {
    this.filters.push((row) => (row[column] as number) <= value);
    return this;
  }
  not(column: string, operator: string, value: unknown) {
    const inner = new FakeQuery(this.world, this.table);
    (inner as unknown as Record<string, (...a: unknown[]) => unknown>)[
      operator === 'in' ? 'inList' : operator
    ](column, value);
    const [test] = inner.filters;
    this.filters.push((row) => !test(row));
    return this;
  }
  // `not(col, 'in', '(a,b)')` carries its list as a string.
  private inList(column: string, value: string) {
    const values = value.replace(/^\(|\)$/g, '').split(',');
    this.filters.push((row) => values.includes(String(row[column])));
    return this;
  }
  filter(column: string, operator: string, value: string) {
    if (operator === 'cs') {
      const want = JSON.parse(value);
      this.filters.push((row) => contains(row[column], want));
    } else if (operator === 'eq') {
      return this.eq(column, value);
    } else {
      throw new Error(`fake: unsupported filter operator ${operator}`);
    }
    return this;
  }
  order(column: string, opts: { ascending?: boolean } = {}) {
    this.orders.push({ column, ascending: opts.ascending !== false });
    return this;
  }
  range(from: number, to: number) {
    this.from_ = from;
    this.to_ = to;
    return this;
  }
  limit(count: number) {
    this.limit_ = count;
    return this;
  }
  single() {
    this.one = 'single';
    return this;
  }
  maybeSingle() {
    this.one = 'maybe';
    return this;
  }

  then<A = Result, B = never>(
    onfulfilled?: ((value: Result) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): Promise<A | B> {
    return Promise.resolve()
      .then(() => this.execute())
      .then(onfulfilled, onrejected);
  }

  private shape(rows: Row[]): Result {
    const out = rows.map((row) => clone(row));
    if (this.one) {
      if (out.length === 1) return { data: out[0], error: null };
      if (out.length === 0 && this.one === 'maybe') {
        return { data: null, error: null };
      }
      return { data: null, error: { message: 'single row expected' } };
    }
    return { data: out, error: null };
  }

  private execute(): Result {
    const { world, table } = this;
    const stored = (world.tables[table] ??= []);
    const matching = () =>
      stored.filter((row) => this.filters.every((f) => f(row)));

    if (this.action === 'select') {
      let rows = matching();
      for (const { column, ascending } of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const x = a[column] as number | string;
          const y = b[column] as number | string;
          const order = x < y ? -1 : x > y ? 1 : 0;
          return ascending ? order : -order;
        });
      }
      rows = rows.slice(this.from_, this.to_ + 1).slice(0, this.limit_);
      return this.shape(rows);
    }

    world.writes.push({ kind: this.action, target: table });
    const failure = takeFailure(world, table);
    if (failure?.mode === 'rolled-back') {
      return {
        data: null,
        error: { message: 'injected failure', code: '23505' },
      };
    }

    const touched: Row[] = [];
    if (this.action === 'insert' || this.action === 'upsert') {
      const rows = ([] as Row[]).concat(this.payload as Row | Row[]);
      for (const row of rows) {
        const at = stored.findIndex((r) => r.uuid === row.uuid);
        if (at >= 0 && this.action === 'insert') {
          return {
            data: null,
            error: { message: 'duplicate key value', code: '23505' },
          };
        }
        if (at >= 0) {
          stored[at] = { ...stored[at], ...clone(row) };
          touched.push(stored[at]);
        } else {
          stored.push(clone(row));
          touched.push(stored[stored.length - 1]);
        }
      }
    } else if (this.action === 'update') {
      for (const row of matching()) {
        Object.assign(row, clone(this.payload as Row));
        touched.push(row);
      }
    } else if (this.action === 'delete') {
      const gone = matching();
      world.tables[table] = stored.filter((row) => !gone.includes(row));
      touched.push(...gone);
    }

    if (failure?.mode === 'lost-response') {
      return { data: null, error: { message: 'fetch failed' } };
    }
    return this.returning ? this.shape(touched) : { data: null, error: null };
  }
}

const takeFailure = (world: FakeWorld, target: string) => {
  const rule = world.failures.find((r) => r.target === target);
  if (!rule) return null;
  if ((rule.after ?? 0) > 0) {
    rule.after = (rule.after ?? 0) - 1;
    return null;
  }
  return rule;
};

const upsertRows = (tables: Tables, table: string, rows: Row[]) => {
  const stored = (tables[table] ??= []);
  for (const row of rows) {
    const at = stored.findIndex((r) => r.uuid === row.uuid);
    if (at >= 0) stored[at] = { ...stored[at], ...clone(row) };
    else stored.push(clone(row));
  }
};

/**
 * A fake client over `tables`. `world.failures` can be pushed to at any time.
 * Tables of the draft copy only; the fake does not model views.
 */
export const createFakeClient = (
  tables: Tables,
  options: { failures?: FailureRule[]; allowed?: boolean } = {},
) => {
  const world: FakeWorld = {
    tables,
    writes: [],
    calls: [],
    failures: (options.failures ?? []).map((rule) => ({ ...rule })),
    allowed: options.allowed ?? true,
  };

  const client = {
    from: (table: string) => {
      world.calls.push(table);
      return new FakeQuery(world, table);
    },
    rpc: (name: string, args: Record<string, unknown> = {}) => {
      world.calls.push(`rpc:${name}`);
      if (name === 'authorize') {
        return Promise.resolve({ data: world.allowed, error: null });
      }
      world.writes.push({ kind: 'rpc', target: name });
      const failure = takeFailure(world, name);
      if (failure?.mode === 'rolled-back') {
        return Promise.resolve({
          data: null,
          error: { message: 'injected failure', code: '40001' },
        });
      }
      if (name === 'apply_passage_save') {
        upsertRows(tables, 'passages', args.p_passages as Row[]);
        upsertRows(tables, 'passages', args.p_labels as Row[]);
        upsertRows(tables, 'passage_annotations', args.p_annotations as Row[]);
        const gone = new Set(args.p_delete_annotations as string[]);
        if (gone.size) {
          tables.passage_annotations = (
            tables.passage_annotations ?? []
          ).filter((row) => !gone.has(row.uuid as string));
        }
        const goneP = new Set(args.p_delete_passages as string[]);
        if (goneP.size) {
          tables.passages = (tables.passages ?? []).filter(
            (row) => !goneP.has(row.uuid as string),
          );
          tables.passage_annotations = (
            tables.passage_annotations ?? []
          ).filter((row) => !goneP.has(row.passage_uuid as string));
        }
      } else if (name === 'shift_passage_sorts') {
        for (const row of tables.passages ?? []) {
          if (
            row.work_uuid === args.p_work_uuid &&
            (row.sort as number) >= (args.p_from_sort as number)
          ) {
            row.sort = (row.sort as number) + (args.p_delta as number);
          }
        }
      } else {
        return Promise.resolve({
          data: null,
          error: { message: `fake: unknown rpc ${name}`, code: 'PGRST202' },
        });
      }
      return Promise.resolve(
        failure?.mode === 'lost-response'
          ? { data: null, error: { message: 'fetch failed' } }
          : { data: {}, error: null },
      );
    },
  };

  return { client: client as never, world };
};

export const snapshot = (tables: Tables): Tables => clone(tables);

// ---------------------------------------------------------------- worlds

export const WORK = '11111111-1111-4111-8111-111111111111';
export const OTHER_WORK = '22222222-2222-4222-8222-222222222222';

/** A work with metadata, titles and folio annotation rows, and no passages. */
export const metadataWorld = (): Tables => ({
  works: [
    {
      uuid: WORK,
      toh: 'toh1',
      restriction: false,
      note: null,
      meta: { a: [1, 2] },
    },
    { uuid: OTHER_WORK, toh: 'toh2', restriction: false, note: null },
  ],
  titles: [
    {
      uuid: 't-en-main',
      work_uuid: WORK,
      type: 'mainTitle',
      language: 'en',
      content: 'Old Title',
    },
    {
      uuid: 't-bo-main',
      work_uuid: WORK,
      type: 'mainTitle',
      language: 'bo',
      content: 'Tibetan Title',
    },
    {
      uuid: 't-other',
      work_uuid: OTHER_WORK,
      type: 'mainTitle',
      language: 'en',
      content: 'Other Work Title',
    },
  ],
  folio_annotations: [
    {
      uuid: 'fa-work',
      work_uuid: WORK,
      annotation_type: 'work',
      source_description: 'old description',
    },
    {
      uuid: 'fa-folio',
      work_uuid: WORK,
      annotation_type: 'folio',
      source_description: 'folio row, not to be touched',
    },
    {
      uuid: 'fa-other',
      work_uuid: OTHER_WORK,
      annotation_type: 'work',
      source_description: 'other work description',
    },
  ],
  passages: [],
  passage_annotations: [],
});

export const CONTENT = 'Then the lord [F.90.a] said this';

const annotationRow = (
  uuid: string,
  passage: string,
  type: string,
  start: number,
  end: number,
  content: unknown[] = [],
): Row => ({
  uuid,
  passage_uuid: passage,
  type,
  start,
  end,
  content,
  toh: null,
});

/** A work with two body passages, annotated, for the edit flows. */
export const editWorld = (): Tables => ({
  ...metadataWorld(),
  passages: [
    {
      uuid: 'p1',
      work_uuid: WORK,
      content: CONTENT,
      label: '1.10',
      sort: 548,
      type: 'translation',
      xmlId: 'x-1',
    },
    {
      uuid: 'p2',
      work_uuid: WORK,
      content: 'The second passage.',
      label: '1.11',
      sort: 549,
      type: 'translation',
      xmlId: 'x-2',
    },
  ],
  passage_annotations: [
    annotationRow('a-span', 'p1', 'span', 5, 8, [{ 'text-style': 'emphasis' }]),
    annotationRow('a-note', 'p1', 'end-note-link', 32, 32, [{ uuid: 'n1' }]),
  ],
});
