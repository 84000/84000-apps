/**
 * @jest-environment node
 */
// Node rather than jsdom: the policy version is a Web Crypto SHA-256, and
// jsdom's environment exposes neither `crypto.subtle` nor `TextEncoder`.
import {
  archivePathFor,
  archiveStamp,
  listPolicies,
  listPolicyRevisions,
  policyName,
  policyPath,
  policyVersion,
  readPolicies,
  readPolicy,
  readPolicyRevision,
  restorePolicy,
  writePolicy,
} from './harness';
import type { DataClient } from './types';

type ListResult = { data: unknown; error: { message: string } | null };

type StorageError = { message: string; status?: number; statusCode?: string };

type RemoveResult = { data: unknown; error: StorageError | null };

type MockCalls = {
  list: string[];
  download: string[];
  copy: [string, string][];
  upload: { path: string; upsert?: boolean }[];
  remove: string[][];
  rpc: string[];
  /** Every mutating call in order, e.g. `copy a/b.md -> archive/...`. */
  writes: string[];
};

/**
 * Serves storage results per operation and records what was asked for. `list`
 * is keyed by prefix because the policy listing descends one level, so the
 * order of the two calls is what the test needs to see. It also backs the
 * existence check that precedes a write, which is a filtered listing.
 */
const createMockClient = ({
  lists = {},
  downloads = {},
  downloadError = null,
  copyError = null,
  uploadError = null,
  remove = (paths) => ({
    data: paths.map((name) => ({ name })),
    error: null,
  }),
  admin = true,
}: {
  lists?: Record<string, ListResult>;
  downloads?: Record<string, string | null>;
  downloadError?: { message: string; status?: number } | null;
  copyError?:
    | StorageError
    | null
    | ((from: string, to: string) => StorageError | null);
  uploadError?: StorageError | null;
  remove?: (paths: string[]) => RemoveResult;
  admin?: boolean;
}) => {
  const calls: MockCalls = {
    list: [],
    download: [],
    copy: [],
    upload: [],
    remove: [],
    rpc: [],
    writes: [],
  };

  const client = {
    rpc: async (fn: string, args: { requested_permission: string }) => {
      calls.rpc.push(`${fn}:${args.requested_permission}`);
      return { data: admin, error: null };
    },
    storage: {
      from: () => ({
        list: async (prefix: string, options?: { search?: string }) => {
          calls.list.push(prefix);
          const result = lists[prefix] ?? { data: [], error: null };
          if (!options?.search || !Array.isArray(result.data)) return result;
          const data = (result.data as { name: string }[]).filter((e) =>
            e.name.startsWith(options.search as string),
          );
          return { ...result, data };
        },
        download: async (path: string) => {
          calls.download.push(path);
          if (downloadError) return { data: null, error: downloadError };
          const content = downloads[path];
          // Only `.text()` is consumed, and jsdom's Blob does not implement it.
          return content == null
            ? {
                data: null,
                error: { message: 'Object not found', status: 404 },
              }
            : { data: { text: async () => content }, error: null };
        },
        copy: async (from: string, to: string) => {
          calls.copy.push([from, to]);
          calls.writes.push(`copy ${from} -> ${to}`);
          const error =
            typeof copyError === 'function' ? copyError(from, to) : copyError;
          return { data: null, error };
        },
        upload: async (
          path: string,
          _body: Blob,
          opts?: { upsert?: boolean },
        ) => {
          calls.upload.push({ path, upsert: opts?.upsert });
          calls.writes.push(`upload ${path}`);
          return { data: null, error: uploadError };
        },
        remove: async (paths: string[]) => {
          calls.remove.push(paths);
          calls.writes.push(`remove ${paths.join(',')}`);
          return remove(paths);
        },
      }),
    },
  } as unknown as DataClient;

  return { client, calls };
};

const folder = (name: string) => ({ id: null, name });
const file = (name: string) => ({ id: name, name });

describe('policy names and paths', () => {
  it('round-trips a name through its object path', () => {
    const name = 'translator-guidelines/IV.B-proper-names';
    expect(policyPath(name)).toBe(`${name}.md`);
    expect(policyName(policyPath(name))).toBe(name);
  });

  it('leaves a path that already carries the suffix alone', () => {
    expect(policyPath('a/b.md')).toBe('a/b.md');
  });

  it('stamps an archive path that sorts chronologically', () => {
    const at = new Date('2026-09-08T19:30:00.000Z');
    expect(archiveStamp(at)).toBe('20260908T193000Z');
    expect(archivePathFor('translator-guidelines/IV.B-proper-names', at)).toBe(
      'archive/translator-guidelines/IV.B-proper-names.md/20260908T193000Z.md',
    );
  });
});

describe('listPolicies', () => {
  it('descends one level and skips the archive', async () => {
    const { client, calls } = createMockClient({
      lists: {
        '': {
          data: [
            folder('translator-guidelines'),
            folder('text-critical-guidelines'),
            folder('archive'),
          ],
          error: null,
        },
        'translator-guidelines': {
          data: [file('IV.B-proper-names.md'), file('IV.C-capitalization.md')],
          error: null,
        },
        'text-critical-guidelines': {
          data: [file('III.i-consult-other-versions.md')],
          error: null,
        },
      },
    });

    expect(await listPolicies({ client })).toEqual([
      'text-critical-guidelines/III.i-consult-other-versions',
      'translator-guidelines/IV.B-proper-names',
      'translator-guidelines/IV.C-capitalization',
    ]);
    expect(calls.list).not.toContain('archive');
  });

  it('ignores non-markdown objects', async () => {
    const { client } = createMockClient({
      lists: {
        '': { data: [folder('translator-guidelines')], error: null },
        'translator-guidelines': {
          data: [file('IV.B-proper-names.md'), file('.emptyFolderPlaceholder')],
          error: null,
        },
      },
    });

    expect(await listPolicies({ client })).toEqual([
      'translator-guidelines/IV.B-proper-names',
    ]);
  });

  it('returns undefined when the listing fails', async () => {
    const { client } = createMockClient({
      lists: { '': { data: null, error: { message: 'denied' } } },
    });
    expect(await listPolicies({ client })).toBeUndefined();
  });
});

describe('policyVersion', () => {
  it('is the lowercase hex SHA-256 of the UTF-8 content', async () => {
    expect(await policyVersion('')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
    expect(await policyVersion('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('hashes the UTF-8 bytes rather than UTF-16 code units', async () => {
    // "é" is 0xc3 0xa9 in UTF-8.
    expect(await policyVersion('\u00e9')).toBe(
      '4a99557e4033c3539de2eb65472017cad5f9557f7a0625a09f1c3f6e2ba69c4c',
    );
  });
});

describe('readPolicy', () => {
  it('resolves a name to its current markdown', async () => {
    const { client } = createMockClient({
      downloads: { 'a/b.md': '## B. Proper names' },
    });
    expect(await readPolicy({ client, name: 'a/b' })).toEqual({
      name: 'a/b',
      content: '## B. Proper names',
      version: await policyVersion('## B. Proper names'),
    });
  });

  it('stays quiet about a policy that does not exist yet', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {
      /* silence */
    });
    const { client } = createMockClient({ downloads: {} });

    expect(await readPolicy({ client, name: 'a/absent' })).toBeUndefined();
    expect(logged).not.toHaveBeenCalled();

    logged.mockRestore();
  });

  it('still logs a failure that is not an absent object', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {
      /* silence */
    });
    const { client } = createMockClient({
      downloadError: { message: 'network unreachable' },
    });

    expect(await readPolicy({ client, name: 'a/b' })).toBeUndefined();
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it('reports the names it could not resolve without losing the rest', async () => {
    const { client } = createMockClient({ downloads: { 'a/b.md': 'kept' } });
    expect(await readPolicies({ client, names: ['a/b', 'a/missing'] })).toEqual(
      {
        policies: [
          {
            name: 'a/b',
            content: 'kept',
            version: await policyVersion('kept'),
          },
        ],
        missing: ['a/missing'],
      },
    );
  });
});

const at = new Date('2026-09-08T19:30:00.000Z');
const STAMPED = 'archive/a/b.md/20260908T193000Z.md';

/** `a/b.md` is live with content `old`. */
const live = { a: { data: [file('b.md')], error: null } };
const liveOld = { lists: live, downloads: { 'a/b.md': 'old' } };

describe('writePolicy', () => {
  it('archives the current revision before replacing it', async () => {
    const { client, calls } = createMockClient({ lists: live });

    const result = await writePolicy({
      client,
      name: 'a/b',
      content: 'new',
      at,
    });

    expect(result).toEqual({
      ok: true,
      version: await policyVersion('new'),
      created: false,
      archivedPath: STAMPED,
    });
    expect(calls.writes).toEqual([
      `copy a/b.md -> ${STAMPED}`,
      'upload a/b.md',
    ]);
    expect(calls.upload).toEqual([{ path: 'a/b.md', upsert: true }]);
  });

  it('abandons the write when the archive copy fails', async () => {
    const { client, calls } = createMockClient({
      lists: live,
      copyError: { message: 'archive is append-only' },
    });

    const result = await writePolicy({ client, name: 'a/b', content: 'new' });

    expect(result).toMatchObject({
      reason: 'error',
      message: expect.stringContaining('archive is append-only'),
    });
    expect(calls.upload).toEqual([]);
  });

  it('creates a new policy without archiving anything', async () => {
    const { client, calls } = createMockClient({ lists: {} });

    const result = await writePolicy({
      client,
      name: 'a/new',
      content: 'text',
    });

    expect(result).toMatchObject({ ok: true, created: true });
    expect(result.ok && result.archivedPath).toBeUndefined();
    expect(calls.copy).toEqual([]);
  });

  it('maps an RLS upload refusal to forbidden', async () => {
    const { client } = createMockClient({
      uploadError: {
        message: 'new row violates row-level security policy',
        status: 400,
        statusCode: '403',
      },
    });
    const result = await writePolicy({ client, name: 'a/new', content: 't' });
    expect(result).toEqual({ ok: false, reason: 'forbidden' });
  });

  it('does not overwrite when it cannot tell whether a revision is there', async () => {
    const { client, calls } = createMockClient({
      lists: { a: { data: null, error: { message: 'denied' } } },
    });

    const result = await writePolicy({ client, name: 'a/b', content: 'new' });

    expect(result).toMatchObject({ ok: false, reason: 'error' });
    expect(calls.writes).toEqual([]);
  });

  describe('with expectedVersion', () => {
    it('writes when the live content still matches', async () => {
      const { client, calls } = createMockClient(liveOld);

      const result = await writePolicy({
        client,
        name: 'a/b',
        content: 'new',
        expectedVersion: await policyVersion('old'),
        at,
      });

      expect(result).toMatchObject({ ok: true, archivedPath: STAMPED });
      expect(calls.writes).toEqual([
        `copy a/b.md -> ${STAMPED}`,
        'upload a/b.md',
      ]);
    });

    it('reports a conflict with the current document and changes nothing', async () => {
      const { client, calls } = createMockClient(liveOld);

      const result = await writePolicy({
        client,
        name: 'a/b',
        content: 'new',
        expectedVersion: await policyVersion('what the caller read'),
      });

      expect(result).toEqual({
        ok: false,
        reason: 'conflict',
        current: {
          name: 'a/b',
          content: 'old',
          version: await policyVersion('old'),
        },
      });
      expect(calls.copy).toEqual([]);
      expect(calls.upload).toEqual([]);
    });

    it('reports not-found when the policy has gone', async () => {
      const { client, calls } = createMockClient({ lists: {} });

      const result = await writePolicy({
        client,
        name: 'a/b',
        content: 'new',
        expectedVersion: await policyVersion('old'),
      });

      expect(result).toEqual({ ok: false, reason: 'not-found' });
      expect(calls.writes).toEqual([]);
    });

    it('fails closed when the current content cannot be read', async () => {
      const { client, calls } = createMockClient({
        lists: live,
        downloadError: { message: 'network unreachable' },
      });

      const result = await writePolicy({
        client,
        name: 'a/b',
        content: 'new',
        expectedVersion: 'anything',
      });

      expect(result).toMatchObject({ ok: false, reason: 'error' });
      expect(calls.writes).toEqual([]);
    });
  });
});

describe('listPolicyRevisions', () => {
  it('lists stamped revisions newest first, ignoring anything else', async () => {
    const { client, calls } = createMockClient({
      lists: {
        'archive/a/b.md': {
          data: [
            file('20260101T000000Z.md'),
            file('20260908T193000Z.md'),
            file('.emptyFolderPlaceholder'),
            file('20260908T193000Z.md.bak'),
            folder('20260301T120000Z.md'),
            file('20260501T080910Z.md'),
          ],
          error: null,
        },
      },
    });

    const revision = (stamp: string, archivedAt: string) => ({
      name: 'a/b',
      path: `archive/a/b.md/${stamp}.md`,
      archivedAt,
    });
    expect(await listPolicyRevisions({ client, name: 'a/b' })).toEqual([
      revision('20260908T193000Z', '2026-09-08T19:30:00.000Z'),
      revision('20260501T080910Z', '2026-05-01T08:09:10.000Z'),
      revision('20260101T000000Z', '2026-01-01T00:00:00.000Z'),
    ]);
    // One level only: the folder entry is not descended into.
    expect(calls.list).toEqual(['archive/a/b.md']);
  });

  it('returns an empty history for a policy with none', async () => {
    const { client } = createMockClient({});
    expect(await listPolicyRevisions({ client, name: 'a/b' })).toEqual([]);
  });

  it('returns undefined when the listing fails', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {
      /* silence */
    });
    const { client } = createMockClient({
      lists: { 'archive/a/b.md': { data: null, error: { message: 'denied' } } },
    });

    expect(await listPolicyRevisions({ client, name: 'a/b' })).toBeUndefined();

    logged.mockRestore();
  });
});

describe('readPolicyRevision', () => {
  it('reads an archived revision and derives its policy name', async () => {
    const { client } = createMockClient({
      downloads: { [STAMPED]: 'archived text' },
    });

    expect(await readPolicyRevision({ client, path: STAMPED })).toEqual({
      revision: {
        name: 'a/b',
        path: STAMPED,
        archivedAt: '2026-09-08T19:30:00.000Z',
      },
      content: 'archived text',
    });
  });

  it.each([
    ['a live object', 'a/b.md'],
    ['an archive folder', 'archive/a/b.md'],
    ['a key that is not stamped', 'archive/a/b.md/latest.md'],
    ['a key outside the archive', 'other/a/b.md/20260908T193000Z.md'],
    ['a key with a dot segment', 'archive/../b.md/20260908T193000Z.md'],
    ['a key nested too deep', 'archive/a/c/b.md/20260908T193000Z.md'],
  ])('refuses %s without reading it', async (_, path) => {
    const { client, calls } = createMockClient({
      downloads: { [path]: 'text' },
    });

    expect(await readPolicyRevision({ client, path })).toBeUndefined();
    expect(calls.download).toEqual([]);
  });

  it('returns undefined for a revision that is not there', async () => {
    const { client } = createMockClient({});
    expect(await readPolicyRevision({ client, path: STAMPED })).toBeUndefined();
  });
});

describe('restorePolicy', () => {
  const OLDER = 'archive/a/b.md/20260101T000000Z.md';

  it('writes the revision content as a new write, archiving the current one', async () => {
    const { client, calls } = createMockClient({
      lists: live,
      downloads: { 'a/b.md': 'current', [OLDER]: 'restored' },
    });

    const result = await restorePolicy({
      client,
      name: 'a/b',
      revisionPath: OLDER,
      expectedVersion: await policyVersion('current'),
      at,
    });

    expect(result).toEqual({
      ok: true,
      version: await policyVersion('restored'),
      created: false,
      archivedPath: STAMPED,
    });
    // The only archive key touched is the new copy of the current revision.
    expect(calls.writes).toEqual([
      `copy a/b.md -> ${STAMPED}`,
      'upload a/b.md',
    ]);
  });

  it('restores a revision from another policy archive onto this name', async () => {
    const { client, calls } = createMockClient({
      downloads: { 'archive/a/old-name.md/20260101T000000Z.md': 'before' },
    });

    const result = await restorePolicy({
      client,
      name: 'a/b',
      revisionPath: 'archive/a/old-name.md/20260101T000000Z.md',
    });

    expect(result).toMatchObject({ ok: true, created: true });
    expect(calls.writes).toEqual(['upload a/b.md']);
  });

  it('reports not-found for a missing revision and writes nothing', async () => {
    const { client, calls } = createMockClient({ lists: live });

    const result = await restorePolicy({
      client,
      name: 'a/b',
      revisionPath: OLDER,
    });

    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(calls.writes).toEqual([]);
  });
});
