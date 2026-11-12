// Removing glossary instances through the real passage save, against an
// in-memory stand-in for PostgREST and apply_passage_save.
import { removeGlossaryTermInstances } from './remove-instances';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

type Log = {
  /** Annotation uuids each save asked the database to delete. */
  saves: string[][];
  /** Writes that bypassed the save, straight to a table. */
  directWrites: string[];
};

class FakeQuery {
  private filters: ((row: Row) => boolean)[] = [];
  private from_ = 0;
  private to_ = Infinity;
  private max = Infinity;
  private one = false;

  constructor(
    private readonly tables: Tables,
    private readonly table: string,
    private readonly log: Log,
  ) {}

  select() {
    return this;
  }
  delete() {
    this.log.directWrites.push(`delete ${this.table}`);
    return this;
  }
  update() {
    this.log.directWrites.push(`update ${this.table}`);
    return this;
  }
  insert() {
    this.log.directWrites.push(`insert ${this.table}`);
    return this;
  }
  upsert() {
    this.log.directWrites.push(`upsert ${this.table}`);
    return Promise.resolve({ error: null });
  }
  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push((row) => row[column] !== value);
    return this;
  }
  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push((row) => (row[column] ?? null) === value);
    return this;
  }
  not(column: string, operator: string, value: string) {
    if (operator === 'like') {
      const prefix = value.replace(/%$/, '');
      this.filters.push((row) => !String(row[column]).startsWith(prefix));
    } else if (operator === 'in') {
      const values = value.replace(/^\(|\)$/g, '').split(',');
      this.filters.push((row) => !values.includes(String(row[column])));
    } else {
      throw new Error(`unsupported operator ${operator}`);
    }
    return this;
  }
  order() {
    return this;
  }
  limit(n: number) {
    this.max = n;
    return this;
  }
  range(from: number, to: number) {
    this.from_ = from;
    this.to_ = to;
    return this;
  }
  single() {
    this.one = true;
    return this;
  }
  maybeSingle() {
    this.one = true;
    return this;
  }

  then<T>(
    onfulfilled: (value: { data: unknown; error: null }) => T,
  ): Promise<T> {
    const rows = (this.tables[this.table] ?? [])
      .filter((row) => this.filters.every((f) => f(row)))
      .slice(this.from_, this.to_ + 1)
      .slice(0, this.max)
      .map((row) => ({ ...row }));
    return Promise.resolve({
      data: this.one ? (rows[0] ?? null) : rows,
      error: null,
    }).then(onfulfilled);
  }
}

const WORK = 'w1';
const TERM = 'g1';

const passage = (n: number): Row => ({
  uuid: `p${n}`,
  work_uuid: WORK,
  content: `Passage ${n} says bodhisattva twice: bodhisattva.`,
  label: `1.${n}`,
  sort: n,
  type: 'translation',
  xmlId: `x-${n}`,
});

const instance = (
  uuid: string,
  passageUuid: string,
  start: number,
  end: number,
  term = TERM,
): Row => ({
  uuid,
  passage_uuid: passageUuid,
  type: 'glossary-instance',
  start,
  end,
  toh: null,
  content: [
    { type: 'glossary' },
    { uuid: term },
    { authority: 'au1' },
    { glossary_xmlId: 'UT-1' },
  ],
});

const span = (uuid: string, passageUuid: string): Row => ({
  uuid,
  passage_uuid: passageUuid,
  type: 'span',
  start: 0,
  end: 7,
  toh: null,
  content: [{ 'text-style': 'emphasis' }],
});

/** Three passages, each with two instances of the term, one of another, a span. */
const fixture = (): Tables => ({
  passages: [passage(1), passage(2), passage(3)],
  passage_annotations: [
    instance('a1', 'p1', 12, 23),
    instance('a2', 'p1', 31, 42),
    instance('o1', 'p1', 0, 7, 'other'),
    span('s1', 'p1'),
    instance('b1', 'p2', 12, 23),
    instance('b2', 'p2', 31, 42),
    span('s2', 'p2'),
    instance('c1', 'p3', 12, 23),
    instance('c2', 'p3', 31, 42),
    span('s3', 'p3'),
  ],
  published_passage_annotations_live: [],
});

const fakeClient = (
  tables: Tables,
  {
    failing = [],
    throwing = [],
  }: { failing?: string[]; throwing?: string[] } = {},
) => {
  const log: Log = { saves: [], directWrites: [] };
  const client = {
    from: (table: string) => new FakeQuery(tables, table, log),
    rpc: (name: string, args: Record<string, Row[] | string[]>) => {
      if (name !== 'apply_passage_save') {
        return Promise.resolve({ error: { message: `unknown rpc ${name}` } });
      }
      const gone = args.p_delete_annotations as string[];
      log.saves.push([...gone]);
      if (gone.some((uuid) => throwing.includes(uuid))) {
        return Promise.reject(new Error('connection reset'));
      }
      if (gone.some((uuid) => failing.includes(uuid))) {
        return Promise.resolve({
          data: null,
          error: { message: 'deadlock detected', code: '40P01' },
        });
      }
      for (const table of ['passages', 'passage_annotations'] as const) {
        const rows =
          table === 'passages'
            ? [...(args.p_passages as Row[]), ...(args.p_labels as Row[])]
            : (args.p_annotations as Row[]);
        const stored = (tables[table] ??= []);
        for (const row of rows) {
          const at = stored.findIndex((r) => r.uuid === row.uuid);
          if (at >= 0) stored[at] = { ...stored[at], ...row };
          else stored.push({ ...row });
        }
      }
      tables.passage_annotations = tables.passage_annotations.filter(
        (row) => !gone.includes(row.uuid as string),
      );
      return Promise.resolve({ data: {}, error: null });
    },
  } as never;
  return { client, log };
};

const stored = (tables: Tables) =>
  tables.passage_annotations.map((row) => row.uuid as string).sort();

const remove = (
  tables: Tables,
  annotationUuids: string[],
  options?: Parameters<typeof fakeClient>[1],
) => {
  const { client, log } = fakeClient(tables, options);
  return removeGlossaryTermInstances({
    client,
    workUuid: WORK,
    termUuid: TERM,
    annotationUuids,
  }).then((result) => ({ result, log }));
};

// A failed save logs its error; the failures here are on purpose.
beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('removeGlossaryTermInstances through the passage save', () => {
  it('removes only the instances asked for, leaving the text and the other offsets', async () => {
    const tables = fixture();
    const text = tables.passages.map((p) => p.content);

    const { result } = await remove(tables, ['a1']);

    expect(result.removed).toEqual(['a1']);
    expect(result.failed).toEqual([]);
    expect(stored(tables)).toEqual(
      ['a2', 'o1', 's1', 'b1', 'b2', 's2', 'c1', 'c2', 's3'].sort(),
    );
    expect(tables.passages.map((p) => p.content)).toEqual(text);
    const byUuid = new Map(tables.passage_annotations.map((r) => [r.uuid, r]));
    expect(byUuid.get('a2')).toMatchObject({ start: 31, end: 42 });
    expect(byUuid.get('s1')).toMatchObject({ start: 0, end: 7 });
    expect(byUuid.get('o1')).toMatchObject({ start: 0, end: 7 });
    expect(result.passages.map((p) => p.uuid)).toEqual(['p1']);
    const annotations = JSON.stringify(result.passages[0].annotations);
    expect(annotations).not.toContain('"a1"');
    expect(annotations).toContain('a2');
  });

  it('saves each passage once, with only its own instances, and writes no table directly', async () => {
    const tables = fixture();
    const text = tables.passages.map((p) => p.content);

    const { result, log } = await remove(tables, ['a1', 'a2', 'b1', 'c2']);

    expect(log.saves.map((gone) => [...gone].sort())).toEqual(
      expect.arrayContaining([['a1', 'a2'], ['b1'], ['c2']]),
    );
    expect(log.saves).toHaveLength(3);
    expect(log.directWrites).toEqual([]);
    expect([...result.removed].sort()).toEqual(['a1', 'a2', 'b1', 'c2']);
    expect(result.failed).toEqual([]);
    expect(stored(tables)).toEqual(['o1', 's1', 'b2', 's2', 'c1', 's3'].sort());
    expect(tables.passages.map((p) => p.content)).toEqual(text);
    expect(result.passages.map((p) => p.uuid).sort()).toEqual([
      'p1',
      'p2',
      'p3',
    ]);
  });

  it('keeps a failed passage’s instances and names it, while the others stay removed', async () => {
    const tables = fixture();

    const { result } = await remove(tables, ['a1', 'b1', 'b2', 'c1'], {
      failing: ['b1'],
    });

    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toMatchObject({
      passageUuid: 'p2',
      passageLabel: '1.2',
      error: expect.stringContaining('deadlock detected'),
    });
    expect([...result.failed[0].annotationUuids].sort()).toEqual(['b1', 'b2']);
    expect([...result.removed].sort()).toEqual(['a1', 'c1']);
    expect(result.passages.map((p) => p.uuid).sort()).toEqual(['p1', 'p3']);
    const left = stored(tables);
    expect(left).toEqual(expect.arrayContaining(['b1', 'b2']));
    expect(left).not.toContain('a1');
    expect(left).not.toContain('c1');
  });

  it('reports a save that throws as that passage’s failure', async () => {
    const tables = fixture();

    const { result } = await remove(tables, ['a1', 'b1'], { throwing: ['a1'] });

    expect(result.failed.map((f) => f.passageUuid)).toEqual(['p1']);
    expect(result.removed).toEqual(['b1']);
  });
});
