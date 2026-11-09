import { getGlossaryInstance } from './instance';

/**
 * DEV-881 acceptance: for the draft source, the single-entry fetch reads through the
 * `glossary_term_by_uuid` RPC (0 or 1 row) instead of a relation, keeps the edge fallback
 * from a child uuid to its parent, and returns the instance it returns today. The
 * published source is unchanged.
 */

const row = {
  glossary_uuid: 'parent-uuid',
  authority_uuid: 'authority-uuid',
  work_uuid: 'work-uuid',
  definition: 'a definition',
  english: 'English',
  wylie: 'wylie',
  tibetan: 'tibetan',
  sanskrit_plain: 'sanskrit',
  sanskrit_attested: 'sanskrit attested',
  chinese: 'chinese',
  pali: 'pali',
  alternatives: 'alt',
  term_number: null, // glossary_term_by_uuid may leave the number null
};

const expected = {
  uuid: 'parent-uuid',
  authority: 'authority-uuid',
  workUuid: 'work-uuid',
  definition: 'a definition',
  termNumber: 0,
  names: {
    english: 'English',
    tibetan: 'tibetan',
    sanskrit: 'sanskrit',
    pali: 'pali',
    chinese: 'chinese',
    wylie: 'wylie',
    alternatives: 'alt',
  },
};

type Result = { data: unknown; error: unknown };

/** A builder that answers however it is awaited: as a list, or via maybeSingle/single. */
const listBuilder = (rows: unknown[], error: unknown = null) => {
  const asList: Result = { data: error ? null : rows, error };
  const asOne: Result = { data: error ? null : (rows[0] ?? null), error };
  const builder: Record<string, unknown> = {
    then: (ok: (v: Result) => unknown, bad: (r: unknown) => unknown) =>
      Promise.resolve(asList).then(ok, bad),
  };
  for (const m of ['select', 'limit', 'eq', 'order'])
    builder[m] = () => builder;
  builder['maybeSingle'] = () => Promise.resolve(asOne);
  builder['single'] = () => Promise.resolve(asOne);
  return builder;
};

const createClient = ({
  rpcRows,
  rpcError = null,
  edge = null,
}: {
  /** Rows returned by glossary_term_by_uuid, keyed by the requested uuid. */
  rpcRows: Record<string, unknown[]>;
  rpcError?: unknown;
  edge?: { parent_uuid: string } | null;
}) => {
  const rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const fromCalls: string[] = [];
  const client = {
    rpc: jest.fn((fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (fn !== 'glossary_term_by_uuid') {
        return listBuilder([], { message: `unexpected rpc ${fn}` });
      }
      return listBuilder(
        rpcRows[args['p_glossary_uuid'] as string] ?? [],
        rpcError,
      );
    }),
    from: jest.fn((table: string) => {
      fromCalls.push(table);
      if (table === 'glossary_edges') {
        return listBuilder(edge ? [edge] : []);
      }
      return listBuilder([], { message: `unexpected relation ${table}` });
    }),
  };
  return { client: client as never, rpcCalls, fromCalls };
};

describe('getGlossaryInstance, draft source', () => {
  it('reads the entry through glossary_term_by_uuid and no relation', async () => {
    const { client, rpcCalls, fromCalls } = createClient({
      rpcRows: { 'parent-uuid': [row] },
    });

    const result = await getGlossaryInstance({
      client,
      uuid: 'parent-uuid',
      source: 'draft',
    });

    expect(result).toEqual(expected);
    expect(rpcCalls).toEqual([
      { fn: 'glossary_term_by_uuid', args: { p_glossary_uuid: 'parent-uuid' } },
    ]);
    expect(fromCalls).toEqual([]);
  });

  it('falls back to glossary_edges and retries with the parent uuid', async () => {
    const { client, rpcCalls, fromCalls } = createClient({
      rpcRows: { 'child-uuid': [], 'parent-uuid': [row] },
      edge: { parent_uuid: 'parent-uuid' },
    });

    const result = await getGlossaryInstance({
      client,
      uuid: 'child-uuid',
      source: 'draft',
    });

    expect(result?.uuid).toBe('parent-uuid');
    expect(result?.workUuid).toBe('work-uuid');
    expect(rpcCalls.map((c) => c.args['p_glossary_uuid'])).toEqual([
      'child-uuid',
      'parent-uuid',
    ]);
    expect(fromCalls).toEqual(['glossary_edges']);
  });

  it('returns undefined when neither the entry nor an edge resolves', async () => {
    const { client } = createClient({ rpcRows: {}, edge: null });
    const result = await getGlossaryInstance({
      client,
      uuid: 'missing-uuid',
      source: 'draft',
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined, without throwing, when the call fails', async () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { client } = createClient({
      rpcRows: { 'parent-uuid': [row] },
      rpcError: { message: 'boom' },
      edge: null,
    });
    const result = await getGlossaryInstance({
      client,
      uuid: 'parent-uuid',
      source: 'draft',
    });
    spy.mockRestore();
    expect(result).toBeUndefined();
  });
});

describe('getGlossaryInstance, published source', () => {
  it('still reads published_glossaries_live and calls no glossary rpc', async () => {
    const rpcs: string[] = [];
    const fromCalls: string[] = [];
    const client = {
      from: (table: string) => {
        fromCalls.push(table);
        return listBuilder([row]);
      },
      rpc: (fn: string) => {
        rpcs.push(fn);
        return listBuilder([], { message: 'unexpected' });
      },
    } as never;

    const result = await getGlossaryInstance({
      client,
      uuid: 'parent-uuid',
      source: 'published',
    });

    expect(result).toEqual(expected);
    expect(fromCalls).toEqual(['published_glossaries_live']);
    expect(rpcs).toEqual([]);
  });
});
