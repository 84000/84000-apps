import { getPassageAlignments, getWorkAlignments } from './alignment';
import type { DataClient } from './types';

type FakeRow = Record<string, unknown>;

type Call = {
  relation: string;
  columns?: string;
  inValues?: unknown[];
  eq: Record<string, unknown>;
  or?: string;
  limit?: number;
  single?: boolean;
};

class FakeQueryBuilder {
  constructor(
    private readonly rows: FakeRow[],
    private readonly call: Call,
    private readonly error?: { message: string },
  ) {}

  select(columns?: string) {
    this.call.columns = columns;
    return this;
  }

  in(_column: string, values: unknown[]) {
    this.call.inValues = values;
    return this;
  }

  eq(column: string, value: unknown) {
    this.call.eq[column] = value;
    return this;
  }

  order() {
    return this;
  }

  or(filter: string) {
    this.call.or = filter;
    return this;
  }

  limit(count: number) {
    this.call.limit = count;
    return this;
  }

  single() {
    this.call.single = true;
    return this;
  }

  then<T>(onfulfilled?: (value: unknown) => T) {
    // Apply the filters the reader actually sets, so a test can assert on the
    // rows that come back rather than only on the query that was built.
    let matched = this.rows;
    const eqUuid = this.call.eq['uuid'];
    if (eqUuid !== undefined) {
      matched = matched.filter((row) => row['uuid'] === eqUuid);
    }
    if (this.call.or) {
      const [, gtSort, eqSort, gtUuid] =
        /^sort\.gt\.(\S+?),and\(sort\.eq\.(\S+?),uuid\.gt\.(\S+?)\)$/.exec(
          this.call.or,
        ) ?? [];
      matched = matched.filter(
        (row) =>
          Number(row['sort']) > Number(gtSort) ||
          (Number(row['sort']) === Number(eqSort) &&
            String(row['uuid']) > String(gtUuid)),
      );
    }
    const from = 0;
    const to = (this.call.limit ?? matched.length) - 1;
    // Project to the selected columns the way PostgREST does — a column the
    // query did not ask for must not reach the mapper.
    const selected = this.call.columns?.split(',').map((c) => c.trim());
    const rows = matched
      .slice(from, to + 1)
      .map((row) =>
        selected
          ? Object.fromEntries(
              Object.entries(row).filter(([key]) => selected.includes(key)),
            )
          : row,
      );
    const result = this.error
      ? { data: null, error: this.error }
      : { data: this.call.single ? (rows[0] ?? null) : rows, error: null };
    return Promise.resolve(result).then(onfulfilled);
  }
}

const fakeClient = (
  tables: Record<string, FakeRow[]>,
  calls: Call[],
  errors: Record<string, { message: string }> = {},
) =>
  ({
    from(relation: string) {
      const call: Call = { relation, eq: {} };
      calls.push(call);
      return new FakeQueryBuilder(
        tables[relation] ?? [],
        call,
        errors[relation],
      );
    },
  }) as unknown as DataClient;

const passage = (uuid: string, sort: number, type = 'translation') => ({
  uuid,
  sort,
  type,
});

const alignmentRow = (
  passage_uuid: string,
  overrides: Partial<FakeRow> = {},
) => ({
  passage_uuid,
  folio_uuid: `folio-${passage_uuid}`,
  toh: 'toh312',
  tibetan: 'སངས་རྒྱས་',
  folio_number: 157,
  volume_number: 72,
  label: '1.1',
  ...overrides,
});

describe('getWorkAlignments', () => {
  it('returns alignments in passage reading order, not view order', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      {
        published_passages_live: [passage('p-1', 1), passage('p-2', 2)],
        // Deliberately reversed: the view imposes no passage order.
        passage_alignments: [alignmentRow('p-2'), alignmentRow('p-1')],
      },
      calls,
    );

    const result = await getWorkAlignments({ client, uuid: 'work-1' });

    expect(result.alignments.map((a) => a.passageUuid)).toEqual(['p-1', 'p-2']);
    expect(result.passagesScanned).toBe(2);
    expect(result.hasMore).toBe(false);
    expect(result.nextCursor).toBeUndefined();
  });

  it('scans only passage types that carry alignments', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      { published_passages_live: [passage('p-1', 1)], passage_alignments: [] },
      calls,
    );

    await getWorkAlignments({ client, uuid: 'work-1' });

    expect(calls[0].inValues).toContain('translation');
    expect(calls[0].inValues).toContain('translationHeader');
    expect(calls[0].inValues).not.toContain('introduction');
  });

  // A page of passages can legitimately yield no alignments, so `hasMore` has to
  // come from the passage scan rather than from the length of the result.
  it('reports hasMore from the passage scan, not the alignment count', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      {
        published_passages_live: [
          passage('p-1', 1),
          passage('p-2', 2),
          passage('p-3', 3),
        ],
        passage_alignments: [],
      },
      calls,
    );

    const result = await getWorkAlignments({ client, uuid: 'work-1', size: 2 });

    expect(result.alignments).toEqual([]);
    expect(result.hasMore).toBe(true);
    // The cursor is the last passage SCANNED, not the last that yielded an
    // alignment — otherwise a page ending in unaligned passages rewinds.
    expect(result.nextCursor).toBe('p-2');
  });

  it('resumes after the cursor passage', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      {
        published_passages_live: [
          passage('p-1', 1),
          passage('p-2', 2),
          passage('p-3', 3),
        ],
        passage_alignments: [alignmentRow('p-3')],
      },
      calls,
    );

    const result = await getWorkAlignments({
      client,
      uuid: 'work-1',
      cursor: 'p-2',
    });

    expect(result.alignments.map((a) => a.passageUuid)).toEqual(['p-3']);
    expect(result.passagesScanned).toBe(1);
  });

  // `sort` is not unique within a work, so a cursor keyed on sort alone drops
  // the rest of a duplicate-sort group whenever a page boundary lands inside it.
  it('does not skip the rest of a duplicate-sort group', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      {
        published_passages_live: [
          passage('p-a', 5),
          passage('p-b', 5),
          passage('p-c', 6),
        ],
        passage_alignments: [
          alignmentRow('p-a'),
          alignmentRow('p-b'),
          alignmentRow('p-c'),
        ],
      },
      calls,
    );

    const first = await getWorkAlignments({ client, uuid: 'work-1', size: 1 });
    expect(first.alignments.map((a) => a.passageUuid)).toEqual(['p-a']);
    expect(first.nextCursor).toBe('p-a');

    const second = await getWorkAlignments({
      client,
      uuid: 'work-1',
      cursor: first.nextCursor,
    });

    // p-b shares p-a's sort; a `sort > 5` cursor would have lost it.
    expect(second.alignments.map((a) => a.passageUuid)).toEqual(['p-b', 'p-c']);
  });

  it('returns an empty page for a cursor that names no passage', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      { published_passages_live: [passage('p-1', 1)], passage_alignments: [] },
      calls,
    );

    const result = await getWorkAlignments({
      client,
      uuid: 'work-1',
      cursor: 'nope',
    });

    expect(result.passagesScanned).toBe(0);
    expect(result.hasMore).toBe(false);
  });

  it('omits english unless asked, and includes it when asked', async () => {
    const calls: Call[] = [];
    const rows = {
      published_passages_live: [passage('p-1', 1)],
      passage_alignments: [alignmentRow('p-1', { english: 'Thus did I hear' })],
    };

    const lean = await getWorkAlignments({
      client: fakeClient(rows, calls),
      uuid: 'work-1',
    });
    expect(calls[1].columns).not.toContain('english');
    expect(lean.alignments[0].english).toBeUndefined();

    const full = await getWorkAlignments({
      client: fakeClient(rows, calls),
      uuid: 'work-1',
      includeEnglish: true,
    });
    expect(calls[3].columns).toContain('english');
    expect(full.alignments[0].english).toBe('Thus did I hear');
  });

  // A work catalogued at several points carries one alignment per placement;
  // interleaving them would read as a single broken sequence.
  it('groups multiple placements of one passage by toh', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      {
        published_passages_live: [passage('p-1', 1)],
        passage_alignments: [
          alignmentRow('p-1', { toh: 'toh648', volume_number: 91 }),
          alignmentRow('p-1', { toh: 'toh312', volume_number: 102 }),
          alignmentRow('p-1', { toh: 'toh312', volume_number: 72 }),
        ],
      },
      calls,
    );

    const result = await getWorkAlignments({ client, uuid: 'work-1' });

    expect(result.alignments.map((a) => [a.toh, a.volumeNumber])).toEqual([
      ['toh312', 72],
      ['toh312', 102],
      ['toh648', 91],
    ]);
  });

  it('pins the edition when toh is given', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      { published_passages_live: [passage('p-1', 1)], passage_alignments: [] },
      calls,
    );

    await getWorkAlignments({ client, uuid: 'work-1', toh: 'toh312' });

    expect(calls[1].eq['toh']).toBe('toh312');
  });

  it('reads the draft passages when asked for draft', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      { passages: [passage('p-1', 1)], passage_alignments: [] },
      calls,
    );

    await getWorkAlignments({ client, uuid: 'work-1', source: 'draft' });

    expect(calls[0].relation).toBe('passages');
  });

  it('returns an empty page when the passage scan fails', async () => {
    const calls: Call[] = [];
    const client = fakeClient({ published_passages_live: [] }, calls, {
      published_passages_live: { message: 'boom' },
    });

    const result = await getWorkAlignments({ client, uuid: 'work-1' });

    expect(result).toEqual({
      alignments: [],
      passagesScanned: 0,
      hasMore: false,
    });
  });
});

describe('getPassageAlignments', () => {
  it('groups alignments by passage uuid', async () => {
    const calls: Call[] = [];
    const client = fakeClient(
      {
        passage_alignments: [
          alignmentRow('p-1'),
          alignmentRow('p-1', { toh: 'toh648' }),
          alignmentRow('p-2'),
        ],
      },
      calls,
    );

    const result = await getPassageAlignments({
      client,
      passageUuids: ['p-1', 'p-2'],
    });

    expect(result.get('p-1')).toHaveLength(2);
    expect(result.get('p-2')).toHaveLength(1);
  });

  it('does not query for an empty passage list', async () => {
    const calls: Call[] = [];
    const client = fakeClient({}, calls);

    const result = await getPassageAlignments({ client, passageUuids: [] });

    expect(result.size).toBe(0);
    expect(calls).toHaveLength(0);
  });

  // PostgREST rejects a URL past ~16KB, and a uuid costs ~39 characters in an
  // `in` list, so a long list has to go out in batches rather than one request.
  it('batches long passage lists', async () => {
    const calls: Call[] = [];
    const client = fakeClient({ passage_alignments: [] }, calls);
    const passageUuids = Array.from({ length: 450 }, (_, i) => `p-${i}`);

    await getPassageAlignments({ client, passageUuids });

    expect(calls).toHaveLength(3);
    expect(calls[0].inValues).toHaveLength(200);
    expect(calls[2].inValues).toHaveLength(50);
  });
});
