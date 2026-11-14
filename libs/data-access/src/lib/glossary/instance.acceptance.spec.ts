/**
 * Acceptance tests: the published source never reads the draft glossary tables
 * (`glossaries`, `glossary_edges`) or the `show_glossary_entries` function, which
 * anonymous callers can no longer read. The draft source keeps using them.
 *
 * The client is a recording mock that fails on any forbidden read, so the
 * boundary (which relation a call touches) is what is asserted.
 */
import { getGlossaryInstance, getGlossaryInstances } from './instance';
import type { DataClient } from '../types';

type Row = Record<string, unknown>;
type Filter = { column: string; value: unknown };

const DRAFT_RELATIONS = ['glossaries', 'glossary_edges'];

/**
 * Builds a Supabase-like client. `relations` maps a relation name to its rows;
 * `rpcs` maps a function name to its result. Every chain method returns the
 * builder; `eq` filters are applied when the chain is awaited or ended with
 * `maybeSingle`/`single`. When `forbidDraft` is set, reading `glossaries` or
 * `glossary_edges`, or calling `show_glossary_entries`, is recorded and throws.
 */
const createClient = ({
  relations = {},
  rpcs = {},
  forbidDraft,
  readError = false,
}: {
  relations?: Record<string, Row[]>;
  rpcs?: Record<string, unknown>;
  forbidDraft: boolean;
  /** Make every relation read fail with an error. */
  readError?: boolean;
}) => {
  const from: string[] = [];
  const rpc: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const filters: Array<{ relation: string; filters: Filter[] }> = [];
  const violations: string[] = [];

  const builder = (
    name: string,
    resolve: (applied: Filter[]) => { data: unknown; error: unknown },
    resolveOne: (applied: Filter[]) => { data: unknown; error: unknown },
  ) => {
    const applied: Filter[] = [];
    filters.push({ relation: name, filters: applied });
    const target: Record<string, unknown> = {
      eq: (column: string, value: unknown) => {
        applied.push({ column, value });
        return proxy;
      },
      maybeSingle: () => Promise.resolve(resolveOne(applied)),
      single: () => Promise.resolve(resolveOne(applied)),
      then: (
        onFulfilled: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => Promise.resolve(resolve(applied)).then(onFulfilled, onRejected),
    };
    const proxy: unknown = new Proxy(target, {
      get: (obj, prop) => (prop in obj ? obj[prop as string] : () => proxy),
    });
    return proxy;
  };

  const client = {
    from: (relation: string) => {
      from.push(relation);
      if (forbidDraft && DRAFT_RELATIONS.includes(relation)) {
        violations.push(`from(${relation})`);
        throw new Error(`forbidden read of ${relation}`);
      }
      const matching = (applied: Filter[]) =>
        (relations[relation] ?? []).filter((row) =>
          applied.every(({ column, value }) => row[column] === value),
        );
      const failed = { data: null, error: { message: 'boom' } };
      return builder(
        relation,
        (applied) =>
          readError ? failed : { data: matching(applied), error: null },
        (applied) =>
          readError
            ? failed
            : { data: matching(applied)[0] ?? null, error: null },
      );
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpc.push({ fn, args });
      if (forbidDraft && fn === 'show_glossary_entries') {
        violations.push(`rpc(${fn})`);
        throw new Error(`forbidden call of ${fn}`);
      }
      const result = { data: rpcs[fn] ?? null, error: null };
      return builder(
        fn,
        () => result,
        () => result,
      );
    },
  };

  return {
    client: client as unknown as DataClient,
    from,
    rpc,
    filters,
    violations,
  };
};

const row = (uuid: string, english: string, workUuid = 'work-1'): Row => ({
  glossary_uuid: uuid,
  authority_uuid: `authority-${uuid}`,
  work_uuid: workUuid,
  definition: `definition of ${english}`,
  english,
  wylie: null,
  tibetan: null,
  sanskrit_plain: null,
  chinese: null,
  pali: null,
  alternatives: null,
});

const PUBLISHED = 'published_glossaries_live';

describe('getGlossaryInstances (DEV-915 criteria 2-4, 8)', () => {
  const relations = {
    [PUBLISHED]: [
      row('g-zeta', 'Zeta'),
      row('g-alpha', 'Alpha'),
      row('g-other', 'Other work', 'work-2'),
    ],
    // Present so a stray read would return data rather than fail quietly.
    glossaries: [row('g-draft', 'Draft only')],
  };

  describe('published source', () => {
    it.each([
      ['by default', {}],
      ['when asked for explicitly', { source: 'published' as const }],
      [
        'with attestations',
        { source: 'published' as const, withAttestations: true },
      ],
    ])(
      'reads published_glossaries_live for the work and nothing draft, %s',
      async (_label, extra) => {
        const { client, from, rpc, filters, violations } = createClient({
          relations,
          forbidDraft: true,
        });

        const result = await getGlossaryInstances({
          client,
          uuid: 'work-1',
          ...extra,
        });

        expect(violations).toEqual([]);
        expect(from).toEqual([PUBLISHED]);
        expect(rpc.map((call) => call.fn)).not.toContain(
          'show_glossary_entries',
        );
        expect(filters).toContainEqual({
          relation: PUBLISHED,
          filters: expect.arrayContaining([
            { column: 'work_uuid', value: 'work-1' },
          ]),
        });
        expect(result.map((instance) => instance.uuid)).toEqual([
          'g-alpha',
          'g-zeta',
        ]);
        expect(result[0]).toMatchObject({
          workUuid: 'work-1',
          definition: 'definition of Alpha',
          names: { english: 'Alpha' },
        });
      },
    );

    it('returns an empty list, without throwing, when the view read fails', async () => {
      const spy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const { client, violations } = createClient({
        forbidDraft: true,
        readError: true,
      });

      await expect(
        getGlossaryInstances({ client, uuid: 'work-1' }),
      ).resolves.toEqual([]);
      expect(violations).toEqual([]);
      spy.mockRestore();
    });
  });

  describe('draft source', () => {
    it('calls show_glossary_entries with the work uuid and the attestation flag', async () => {
      const { client, rpc, violations } = createClient({
        rpcs: {
          show_glossary_entries: {
            work_uuid: 'work-1',
            glossary_entries: [
              {
                uuid: 'g-b',
                authority_uuid: 'a-b',
                work_uuid: 'work-1',
                names: { english: 'Beta' },
              },
              {
                uuid: 'g-a',
                authority_uuid: 'a-a',
                work_uuid: 'work-1',
                names: { english: 'Alpha' },
              },
            ],
          },
        },
        forbidDraft: false,
      });

      const result = await getGlossaryInstances({
        client,
        uuid: 'work-1',
        withAttestations: true,
        source: 'draft',
      });

      expect(violations).toEqual([]);
      expect(rpc).toEqual([
        {
          fn: 'show_glossary_entries',
          args: { v_work_uuid: 'work-1', v_with_attestation: true },
        },
      ]);
      expect(result.map((instance) => instance.uuid)).toEqual(['g-a', 'g-b']);
    });

    it('does not read the published view', async () => {
      const { client, from } = createClient({
        rpcs: {
          show_glossary_entries: { work_uuid: 'work-1', glossary_entries: [] },
        },
        forbidDraft: false,
      });

      await getGlossaryInstances({ client, uuid: 'work-1', source: 'draft' });

      expect(from).not.toContain(PUBLISHED);
    });
  });
});

describe('getGlossaryInstance (DEV-915 criteria 2-4, 8)', () => {
  const relations = {
    [PUBLISHED]: [row('g-root', 'Root')],
    // A child uuid resolves to its parent only through the draft edges.
    glossary_edges: [{ parent_uuid: 'g-root', child_uuid: 'g-child' }],
    glossaries: [row('g-root', 'Root'), row('g-child', 'Child')],
  };

  describe('published source', () => {
    it.each([
      ['by default', {}],
      ['when asked for explicitly', { source: 'published' as const }],
    ])(
      'reads published_glossaries_live by glossary_uuid and nothing draft, %s',
      async (_label, extra) => {
        const { client, from, filters, violations } = createClient({
          relations,
          forbidDraft: true,
        });

        const result = await getGlossaryInstance({
          client,
          uuid: 'g-root',
          ...extra,
        });

        expect(violations).toEqual([]);
        expect(from).toEqual([PUBLISHED]);
        expect(filters).toContainEqual({
          relation: PUBLISHED,
          filters: expect.arrayContaining([
            { column: 'glossary_uuid', value: 'g-root' },
          ]),
        });
        expect(result).toMatchObject({
          uuid: 'g-root',
          workUuid: 'work-1',
          names: { english: 'Root' },
        });
      },
    );

    it('resolves a child uuid to undefined without consulting glossary_edges', async () => {
      const { client, from, violations } = createClient({
        relations,
        forbidDraft: true,
      });

      const result = await getGlossaryInstance({
        client,
        uuid: 'g-child',
        source: 'published',
      });

      expect(result).toBeUndefined();
      expect(violations).toEqual([]);
      expect(from).not.toContain('glossary_edges');
      expect(from).not.toContain('glossaries');
    });

    it('resolves an unknown uuid to undefined without any draft read', async () => {
      const { client, violations } = createClient({
        relations,
        forbidDraft: true,
      });

      await expect(
        getGlossaryInstance({ client, uuid: 'nope' }),
      ).resolves.toBeUndefined();
      expect(violations).toEqual([]);
    });
  });

  describe('draft source', () => {
    it('still resolves a child uuid to its parent through glossary_edges', async () => {
      const termRow = { ...row('g-root', 'Root') };
      const rpcCalls: Array<Record<string, unknown>> = [];
      const from: string[] = [];
      const client = {
        rpc: jest.fn((_fn: string, args: Record<string, unknown>) => {
          rpcCalls.push(args);
          return {
            maybeSingle: () =>
              Promise.resolve({
                data: args['p_glossary_uuid'] === 'g-root' ? termRow : null,
                error: null,
              }),
          };
        }),
        from: jest.fn((relation: string) => {
          from.push(relation);
          const chain: Record<string, unknown> = {};
          for (const method of ['select', 'eq', 'limit']) {
            chain[method] = () => chain;
          }
          chain['maybeSingle'] = () =>
            Promise.resolve({
              data:
                relation === 'glossary_edges'
                  ? { parent_uuid: 'g-root' }
                  : null,
              error: null,
            });
          return chain;
        }),
      } as unknown as DataClient;

      const result = await getGlossaryInstance({
        client,
        uuid: 'g-child',
        source: 'draft',
      });

      expect(result?.uuid).toBe('g-root');
      expect(from).toContain('glossary_edges');
      expect(from).not.toContain(PUBLISHED);
    });
  });
});
