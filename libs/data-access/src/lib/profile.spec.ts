import {
  addMyProfileTag,
  getMyAccess,
  getMyProfile,
  toPgArrayLiteral,
} from './profile';

type Row = { id: string; tags: string[]; [key: string]: unknown };

type FakeState = {
  rows: Row[];
  rpc?: { data: unknown; error: { message: string } | null };
  rpcCalls: string[];
  updates: Record<string, unknown>[];
  /** Runs before each UPDATE is applied, to simulate a concurrent writer. */
  beforeUpdate?: () => void;
  selectError?: { message: string };
};

/**
 * Just enough of the Supabase query builder for profile reads and the
 * compare-and-swap update: `eq` filters on `id` and on the whole `tags` array
 * (given as a Postgres array literal).
 */
const createFakeClient = (state: FakeState) => {
  const matches = (row: Row, filters: [string, string][]) =>
    filters.every(([col, value]) =>
      col === 'tags'
        ? toPgArrayLiteral(row.tags) === value
        : String(row[col]) === value,
    );

  const from = () => {
    const filters: [string, string][] = [];
    let patch: Record<string, unknown> | undefined;

    const run = () => {
      if (patch) {
        state.beforeUpdate?.();
        state.updates.push(patch);
        const hit = state.rows.filter((r) => matches(r, filters));
        hit.forEach((r) => Object.assign(r, patch));
        return { data: hit.map((r) => ({ tags: [...r.tags] })), error: null };
      }
      if (state.selectError) return { data: null, error: state.selectError };
      const row = state.rows.find((r) => matches(r, filters));
      return {
        data: row ? { ...row, tags: row.tags && [...row.tags] } : null,
        error: null,
      };
    };

    const builder = {
      select: () => builder,
      update: (p: Record<string, unknown>) => {
        patch = p;
        return builder;
      },
      eq: (col: string, value: string) => {
        filters.push([col, value]);
        return builder;
      },
      maybeSingle: () => Promise.resolve(run()),
      then: (resolve: (v: unknown) => unknown) => resolve(run()),
    };
    return builder;
  };

  return {
    from,
    rpc: (name: string) => {
      state.rpcCalls.push(name);
      return Promise.resolve(state.rpc ?? { data: [], error: null });
    },
  } as never;
};

const state = (
  rows: Row[] = [],
  extra: Partial<FakeState> = {},
): FakeState => ({
  rows,
  rpcCalls: [],
  updates: [],
  ...extra,
});

describe('getMyAccess', () => {
  it('returns the stored role, including manager, from get_my_access', async () => {
    const s = state([], {
      rpc: {
        data: [
          { role: 'manager', permissions: ['projects.read', 'harness.read'] },
        ],
        error: null,
      },
    });

    expect(await getMyAccess({ client: createFakeClient(s) })).toEqual({
      role: 'manager',
      permissions: ['projects.read', 'harness.read'],
    });
    expect(s.rpcCalls).toEqual(['get_my_access']);
  });

  it('returns null when the function fails or returns no row', async () => {
    const failed = state([], {
      rpc: { data: null, error: { message: 'boom' } },
    });
    const empty = state([], { rpc: { data: [], error: null } });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(await getMyAccess({ client: createFakeClient(failed) })).toBeNull();
    expect(await getMyAccess({ client: createFakeClient(empty) })).toBeNull();
  });
});

describe('getMyProfile', () => {
  it('maps the row and never returns null tags', async () => {
    const s = state([
      { id: 'u-1', full_name: 'Dorje', tags: null as never, username: 'dorje' },
    ]);

    expect(
      await getMyProfile({ client: createFakeClient(s), userId: 'u-1' }),
    ).toEqual({ id: 'u-1', fullName: 'Dorje', username: 'dorje', tags: [] });
  });

  it('returns null when there is no row', async () => {
    expect(
      await getMyProfile({ client: createFakeClient(state()), userId: 'u-1' }),
    ).toBeNull();
  });
});

describe('addMyProfileTag', () => {
  const TAG = 'harness.onboarding.completed';

  it('adds a missing tag', async () => {
    const s = state([{ id: 'u-1', tags: [] }]);

    const result = await addMyProfileTag({
      client: createFakeClient(s),
      userId: 'u-1',
      tag: TAG,
    });

    expect(result).toEqual({ ok: true, tags: [TAG], added: true });
    expect(s.rows[0].tags).toEqual([TAG]);
  });

  it('is idempotent: a tag already present writes nothing', async () => {
    const s = state([{ id: 'u-1', tags: [TAG] }]);
    const client = createFakeClient(s);

    const first = await addMyProfileTag({ client, userId: 'u-1', tag: TAG });
    const second = await addMyProfileTag({ client, userId: 'u-1', tag: TAG });

    expect(first).toEqual({ ok: true, tags: [TAG], added: false });
    expect(second).toEqual(first);
    expect(s.updates).toHaveLength(0);
    expect(s.rows[0].tags).toEqual([TAG]);
  });

  it('keeps a tag another writer added between the read and the write', async () => {
    const s = state([{ id: 'u-1', tags: ['other'] }]);
    let raced = false;
    s.beforeUpdate = () => {
      if (raced) return;
      raced = true;
      s.rows[0].tags = ['other', 'concurrent'];
    };

    const result = await addMyProfileTag({
      client: createFakeClient(s),
      userId: 'u-1',
      tag: TAG,
    });

    expect(result).toEqual({
      ok: true,
      tags: ['other', 'concurrent', TAG],
      added: true,
    });
    expect(s.updates).toHaveLength(2);
  });

  it('reports not-found when the profile row is missing or hidden', async () => {
    const result = await addMyProfileTag({
      client: createFakeClient(state()),
      userId: 'u-1',
      tag: TAG,
    });

    expect(result).toEqual({ ok: false, reason: 'not-found' });
  });

  it('reports conflict when every compare-and-swap loses', async () => {
    const s = state([{ id: 'u-1', tags: [] }]);
    let n = 0;
    s.beforeUpdate = () => {
      s.rows[0].tags = [`other-${n++}`];
    };

    const result = await addMyProfileTag({
      client: createFakeClient(s),
      userId: 'u-1',
      tag: TAG,
    });

    expect(result).toEqual({ ok: false, reason: 'conflict' });
    expect(s.rows[0].tags).not.toContain(TAG);
  });
});

describe('toPgArrayLiteral', () => {
  it('quotes and escapes every element', () => {
    expect(toPgArrayLiteral([])).toBe('{}');
    expect(toPgArrayLiteral(['a', 'b,c', 'd"e', 'f\\g'])).toBe(
      '{"a","b,c","d\\"e","f\\\\g"}',
    );
  });
});
