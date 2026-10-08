import { applyPassageEdits } from './edits';
import type { AnnotationDTO, PassageRowDTO } from '../types';

type Row = Record<string, unknown>;
type Tables = Record<string, Row[]>;

/**
 * An in-memory stand-in for PostgREST, enough for the read and save paths to
 * run unmodified: filters are applied, so a read that asks the wrong relation
 * or filters out a row really does not see it.
 */
class FakeQuery {
  private filters: ((row: Row) => boolean)[] = [];
  private action: 'select' | 'delete' = 'select';
  private from_ = 0;
  private to_ = Infinity;
  private fail = false;

  constructor(
    private readonly tables: Tables,
    private readonly table: string,
    private readonly log: { upserts: Row[][]; deletes: string[][] },
  ) {}

  select() {
    return this;
  }

  delete() {
    this.action = 'delete';
    return this;
  }

  upsert(rows: Row[]) {
    const stored = (this.tables[this.table] ??= []);
    for (const row of rows) {
      const at = stored.findIndex((r) => r.uuid === row.uuid);
      if (at >= 0) stored[at] = { ...stored[at], ...row };
      else stored.push({ ...row });
    }
    if (this.table === 'passage_annotations') this.log.upserts.push(rows);
    return Promise.resolve({ error: null });
  }

  eq(column: string, value: unknown) {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push((row) => values.includes(row[column]));
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

  range(from: number, to: number) {
    this.from_ = from;
    this.to_ = to;
    this.fail = this.tables.failRanges !== undefined;
    return this;
  }

  then<T>(
    onfulfilled: (
      value:
        | { data: Row[]; error: null }
        | { data: null; error: { message: string } },
    ) => T,
  ) {
    if (this.fail) {
      return Promise.resolve({
        data: null,
        error: { message: 'boom' },
      }).then(onfulfilled);
    }
    const rows = this.tables[this.table] ?? [];
    const matched = rows.filter((row) => this.filters.every((f) => f(row)));
    if (this.action === 'delete') {
      this.tables[this.table] = rows.filter((row) => !matched.includes(row));
      this.log.deletes.push(matched.map((row) => row.uuid as string));
      return Promise.resolve({ data: [], error: null }).then(onfulfilled);
    }
    const data = matched
      .slice(this.from_, this.to_ + 1)
      .map((row) => ({ ...row }));
    return Promise.resolve({ data, error: null }).then(onfulfilled);
  }
}

const fakeClient = (tables: Tables) => {
  const log = { upserts: [] as Row[][], deletes: [] as string[][] };
  const client = {
    from: (table: string) => new FakeQuery(tables, table, log),
  } as never;
  return { client, log };
};

const WORK = 'w1';
const CONTENT = 'Then the lord [F.90.a] said this';

const passageRow: PassageRowDTO = {
  uuid: 'p1',
  work_uuid: WORK,
  content: CONTENT,
  label: '1.10',
  sort: 548,
  type: 'translation',
  xmlId: 'x-1',
} as PassageRowDTO;

const annotation = (
  uuid: string,
  type: string,
  start: number,
  end: number,
  content: unknown[] = [],
): AnnotationDTO =>
  ({
    uuid,
    passage_uuid: 'p1',
    type,
    start,
    end,
    content,
    toh: null,
  }) as unknown as AnnotationDTO;

// Stored with a legacy field the domain model does not carry.
const glossary = annotation('a-glossary', 'glossary-instance', 5, 8, [
  { type: 'glossary', uuid: 'g1', glossary_xmlId: 'UT-1' },
  { authority: 'au1' },
]);
const marker = annotation('a-marker', 'deprecated-reference', 14, 22, [
  { title: '[F.90.a]' },
]);
const comment = annotation('a-comment', 'comment', 23, 27, [
  { uuid: 'thread-1' },
]);
const note = annotation('a-note', 'end-note-link', 32, 32, [{ uuid: 'n1' }]);

const draft = () => [glossary, marker, comment, note].map((a) => ({ ...a }));

/** A published snapshot holds no legacy rows and no comments. */
const published = () =>
  draft().filter(
    (a) => a.type !== 'comment' && !a.type.startsWith('deprecated'),
  );

const tablesFor = (publishedRows: AnnotationDTO[]): Tables => ({
  passages: [{ ...passageRow }],
  passage_annotations: draft() as unknown as Row[],
  published_passage_annotations_live: publishedRows as unknown as Row[],
});

const storedUuids = (tables: Tables) =>
  tables.passage_annotations.map((row) => row.uuid).sort();

// Names an annotation that is not there: the passage is saved, nothing changes.
const noOp = [
  { op: 'remove-annotation' as const, passageUuid: 'p1', annotationUuid: 'x' },
];

describe('applyPassageEdits', () => {
  it('keeps a deprecated-reference row it cannot model', async () => {
    const tables = tablesFor(published());
    const { client } = fakeClient(tables);

    const result = await applyPassageEdits({
      client,
      workUuid: WORK,
      edits: noOp,
    });

    expect(result.success).toBe(true);
    expect(storedUuids(tables)).toContain('a-marker');
  });

  it('keeps a comment anchor', async () => {
    const tables = tablesFor(published());
    const { client } = fakeClient(tables);

    await applyPassageEdits({ client, workUuid: WORK, edits: noOp });

    expect(storedUuids(tables)).toContain('a-comment');
  });

  it('keeps every annotation on a work that was never published', async () => {
    const tables = tablesFor([]);
    const { client } = fakeClient(tables);

    await applyPassageEdits({ client, workUuid: WORK, edits: noOp });

    expect(storedUuids(tables)).toEqual(
      ['a-comment', 'a-glossary', 'a-marker', 'a-note'].sort(),
    );
  });

  it('warns when a removal names an annotation that is not there', async () => {
    const { client } = fakeClient(tablesFor(published()));

    const result = await applyPassageEdits({
      client,
      workUuid: WORK,
      edits: noOp,
    });

    expect(result.warnings).toEqual([
      expect.objectContaining({ passageUuid: 'p1' }),
    ]);
  });

  it('moves legacy rows and comments past a cut, and deletes only what was cut', async () => {
    const tables = tablesFor(published());
    const { client, log } = fakeClient(tables);

    // Cut the marker text together with the marker.
    await applyPassageEdits({
      client,
      workUuid: WORK,
      edits: [{ op: 'delete-text', passageUuid: 'p1', start: 14, end: 22 }],
    });

    const byUuid = new Map(
      tables.passage_annotations.map((row) => [row.uuid, row]),
    );
    expect([...byUuid.keys()].sort()).toEqual(
      ['a-comment', 'a-glossary', 'a-note'].sort(),
    );
    expect(byUuid.get('a-comment')).toMatchObject({ start: 15, end: 19 });
    expect(byUuid.get('a-note')).toMatchObject({ start: 24, end: 24 });
    expect(log.deletes.flat()).toEqual(['a-marker']);
  });

  it('does not rewrite an annotation the edits leave in place', async () => {
    const tables = tablesFor(published());
    const { client, log } = fakeClient(tables);

    await applyPassageEdits({
      client,
      workUuid: WORK,
      edits: [{ op: 'delete-text', passageUuid: 'p1', start: 14, end: 22 }],
    });

    const written = log.upserts.flat().map((row) => row.uuid);
    expect(written).not.toContain('a-glossary');
    expect(
      tables.passage_annotations.find((row) => row.uuid === 'a-glossary'),
    ).toEqual(glossary);
  });

  it('writes nothing when the annotation read fails', async () => {
    // A paginated read (the annotation read) fails; the passage read does not.
    const tables: Tables = { ...tablesFor(published()), failRanges: [] };
    const { client, log } = fakeClient(tables);

    const result = await applyPassageEdits({
      client,
      workUuid: WORK,
      edits: [{ op: 'delete-text', passageUuid: 'p1', start: 14, end: 22 }],
    });

    expect(result.success).toBe(false);
    expect(tables.passages[0].content).toBe(CONTENT);
    expect(log.deletes).toEqual([]);
  });

  it('saves an added annotation under a fresh uuid', async () => {
    const tables = tablesFor(published());
    const { client } = fakeClient(tables);

    await applyPassageEdits({
      client,
      workUuid: WORK,
      edits: [
        {
          op: 'add-annotation',
          passageUuid: 'p1',
          kind: 'end-note-link',
          start: 13,
          data: { endNote: 'n2' },
        },
      ],
    });

    const added = tables.passage_annotations.filter(
      (row) => row.type === 'end-note-link' && row.start === 13,
    );
    expect(added).toHaveLength(1);
    expect(added[0].uuid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect(storedUuids(tables)).toEqual(
      expect.arrayContaining(['a-comment', 'a-glossary', 'a-marker', 'a-note']),
    );
  });

  it('replaces an annotation removed and re-added at the same range', async () => {
    const tables = tablesFor(published());
    const { client } = fakeClient(tables);

    await applyPassageEdits({
      client,
      workUuid: WORK,
      edits: [
        {
          op: 'remove-annotation',
          passageUuid: 'p1',
          annotationUuid: 'a-note',
        },
        {
          op: 'add-annotation',
          passageUuid: 'p1',
          kind: 'end-note-link',
          start: 32,
          data: { endNote: 'n2' },
        },
      ],
    });

    const notes = tables.passage_annotations.filter(
      (row) => row.type === 'end-note-link',
    );
    expect(notes).toHaveLength(1);
    expect(notes[0].uuid).not.toBe('a-note');
    expect(notes[0]).toMatchObject({ start: 32, end: 32 });
  });

  it('removes an annotation named by uuid', async () => {
    const tables = tablesFor(published());
    const { client } = fakeClient(tables);

    await applyPassageEdits({
      client,
      workUuid: WORK,
      edits: [
        {
          op: 'remove-annotation',
          passageUuid: 'p1',
          annotationUuid: 'a-marker',
        },
      ],
    });

    expect(storedUuids(tables)).toEqual(
      ['a-comment', 'a-glossary', 'a-note'].sort(),
    );
  });
});
