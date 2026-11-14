/**
 * Acceptance tests: the `get-glossary-instances` tool reads the published
 * snapshot by default and never touches `glossaries`, `glossary_edges` or
 * `show_glossary_entries` for it; the draft source stays reachable, per call
 * (`source` input) or per server (`createReadTools` option).
 *
 * The tool runs against a recording mock client, so the boundary asserted is
 * which relation or function the real data-access code reaches for.
 */
import { z } from 'zod';
import type { DataClient } from '@eightyfourthousand/data-access';
import { createReadTools } from './index';

// Importing the read-tools index pulls in tools that depend on the ssr
// entrypoint of data-access, which loads next/server (needs a Request global
// that jest's node env lacks). Those tools are not under test here.
jest.mock('@eightyfourthousand/data-access/ssr', () => ({}));

const PUBLISHED = 'published_glossaries_live';

type Row = Record<string, unknown>;

const createClient = () => {
  const from: string[] = [];
  const rpc: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const violations: string[] = [];

  const rows: Row[] = [
    {
      glossary_uuid: 'g-1',
      authority_uuid: 'a-1',
      work_uuid: 'work-1',
      definition: 'a definition',
      english: 'Alpha',
      wylie: null,
      tibetan: null,
      sanskrit_plain: null,
      chinese: null,
      pali: null,
      alternatives: null,
    },
  ];

  const chain = (result: { data: unknown; error: null }): unknown => {
    const proxy: unknown = new Proxy(
      {
        then: (
          onFulfilled: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => Promise.resolve(result).then(onFulfilled, onRejected),
        maybeSingle: () => Promise.resolve(result),
        single: () => Promise.resolve(result),
      },
      {
        get: (obj, prop) =>
          prop in obj
            ? (obj as Record<string, unknown>)[prop as string]
            : () => proxy,
      },
    );
    return proxy;
  };

  const client = {
    from: (relation: string) => {
      from.push(relation);
      if (relation === 'glossaries' || relation === 'glossary_edges') {
        violations.push(`from(${relation})`);
      }
      return chain({
        data: relation === PUBLISHED ? rows : [],
        error: null,
      });
    },
    rpc: (fn: string, args: Record<string, unknown>) => {
      rpc.push({ fn, args });
      return chain({
        data: { work_uuid: 'work-1', glossary_entries: [] },
        error: null,
      });
    },
  };

  return { client: client as unknown as DataClient, from, rpc, violations };
};

const findTool = (
  client: DataClient,
  options?: Parameters<typeof createReadTools>[1],
) => {
  const tool = createReadTools(client, options).find(
    (candidate) => candidate.name === 'get-glossary-instances',
  );
  if (!tool) throw new Error('get-glossary-instances tool is not registered');
  return tool;
};

const extra = {} as Parameters<ReturnType<typeof findTool>['handler']>[1];

const call = (
  tool: ReturnType<typeof findTool>,
  args: Record<string, unknown>,
) =>
  (tool.handler as (args: unknown, extra: unknown) => Promise<unknown>)(
    args,
    extra,
  );

describe('get-glossary-instances tool (DEV-915 criteria 2-4, 7, 8)', () => {
  it('reads published data by default, with no draft glossary read', async () => {
    const { client, from, rpc, violations } = createClient();
    const tool = findTool(client);

    const result = (await call(tool, {
      uuid: 'a1b2c3d4-0000-4000-8000-000000000001',
    })) as {
      content: Array<{ text: string }>;
    };

    expect(violations).toEqual([]);
    expect(from).toEqual([PUBLISHED]);
    expect(rpc.map((entry) => entry.fn)).not.toContain('show_glossary_entries');
    expect(JSON.parse(result.content[0].text)).toEqual([
      expect.objectContaining({
        uuid: 'g-1',
        names: expect.objectContaining({ english: 'Alpha' }),
      }),
    ]);
  });

  it('reads published data when source "published" is passed', async () => {
    const { client, from, violations } = createClient();

    await call(findTool(client), {
      uuid: 'a1b2c3d4-0000-4000-8000-000000000001',
      source: 'published',
    });

    expect(violations).toEqual([]);
    expect(from).toEqual([PUBLISHED]);
  });

  it('reads the draft copy through show_glossary_entries when source "draft" is passed', async () => {
    const { client, from, rpc } = createClient();

    await call(findTool(client), {
      uuid: 'a1b2c3d4-0000-4000-8000-000000000001',
      withAttestations: true,
      source: 'draft',
    });

    expect(rpc).toEqual([
      {
        fn: 'show_glossary_entries',
        args: {
          v_work_uuid: 'a1b2c3d4-0000-4000-8000-000000000001',
          v_with_attestation: true,
        },
      },
    ]);
    expect(from).not.toContain(PUBLISHED);
  });

  it('uses the createReadTools glossaryInstancesSource option when the call gives no source', async () => {
    const { client, from, rpc } = createClient();

    await call(findTool(client, { glossaryInstancesSource: 'draft' }), {
      uuid: 'a1b2c3d4-0000-4000-8000-000000000001',
    });

    expect(rpc.map((entry) => entry.fn)).toEqual(['show_glossary_entries']);
    expect(from).not.toContain(PUBLISHED);
  });

  it('lets the call source override the createReadTools option', async () => {
    const draftServer = createClient();
    await call(
      findTool(draftServer.client, { glossaryInstancesSource: 'draft' }),
      {
        uuid: 'a1b2c3d4-0000-4000-8000-000000000001',
        source: 'published',
      },
    );
    expect(draftServer.from).toEqual([PUBLISHED]);
    expect(draftServer.violations).toEqual([]);

    const publishedServer = createClient();
    await call(
      findTool(publishedServer.client, {
        glossaryInstancesSource: 'published',
      }),
      { uuid: 'a1b2c3d4-0000-4000-8000-000000000001', source: 'draft' },
    );
    expect(publishedServer.rpc.map((entry) => entry.fn)).toEqual([
      'show_glossary_entries',
    ]);
  });

  describe('input schema', () => {
    const schema = z.object(findTool(createClient().client).inputSchema);
    const uuid = 'a1b2c3d4-0000-4000-8000-000000000001';

    it.each(['draft', 'published', undefined])(
      'accepts source %s',
      (source) => {
        const parsed = schema.safeParse({ uuid, source });
        expect(parsed.success).toBe(true);
        expect(parsed.data?.source).toBe(source);
      },
    );

    it('rejects an unknown source', () => {
      expect(schema.safeParse({ uuid, source: 'live' }).success).toBe(false);
    });

    it('keeps uuid required and withAttestations optional', () => {
      expect(schema.safeParse({}).success).toBe(false);
      expect(schema.safeParse({ uuid, withAttestations: true }).success).toBe(
        true,
      );
    });
  });
});
