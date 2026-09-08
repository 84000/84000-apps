import {
  archivePathFor,
  archiveStamp,
  listPolicies,
  policyName,
  policyPath,
  readPolicies,
  readPolicy,
  writePolicy,
} from './harness';
import type { DataClient } from './types';

type ListResult = { data: unknown; error: { message: string } | null };

type MockCalls = {
  list: string[];
  download: string[];
  copy: [string, string][];
  upload: { path: string; upsert?: boolean }[];
};

/**
 * Serves storage results per operation and records what was asked for. `list`
 * is keyed by prefix because the policy listing descends one level, so the
 * order of the two calls is what the test needs to see.
 */
const createMockClient = ({
  lists = {},
  downloads = {},
  downloadError = null,
  copyError = null,
  uploadError = null,
}: {
  lists?: Record<string, ListResult>;
  downloads?: Record<string, string | null>;
  downloadError?: { message: string; status?: number } | null;
  copyError?: { message: string } | null;
  uploadError?: { message: string } | null;
}) => {
  const calls: MockCalls = { list: [], download: [], copy: [], upload: [] };

  const client = {
    storage: {
      from: () => ({
        list: async (prefix: string) => {
          calls.list.push(prefix);
          return lists[prefix] ?? { data: [], error: null };
        },
        download: async (path: string) => {
          calls.download.push(path);
          if (downloadError) return { data: null, error: downloadError };
          const content = downloads[path];
          // Only `.text()` is consumed, and jsdom's Blob does not implement it.
          return content == null
            ? { data: null, error: { message: 'Object not found', status: 404 } }
            : { data: { text: async () => content }, error: null };
        },
        copy: async (from: string, to: string) => {
          calls.copy.push([from, to]);
          return { data: null, error: copyError };
        },
        upload: async (
          path: string,
          _body: Blob,
          opts?: { upsert?: boolean },
        ) => {
          calls.upload.push({ path, upsert: opts?.upsert });
          return { data: null, error: uploadError };
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

describe('readPolicy', () => {
  it('resolves a name to its current markdown', async () => {
    const { client } = createMockClient({
      downloads: { 'a/b.md': '## B. Proper names' },
    });
    expect(await readPolicy({ client, name: 'a/b' })).toEqual({
      name: 'a/b',
      content: '## B. Proper names',
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
    expect(await readPolicies({ client, names: ['a/b', 'a/missing'] })).toEqual({
      policies: [{ name: 'a/b', content: 'kept' }],
      missing: ['a/missing'],
    });
  });
});

describe('writePolicy', () => {
  const at = new Date('2026-09-08T19:30:00.000Z');

  it('archives the current revision before replacing it', async () => {
    const { client, calls } = createMockClient({
      downloads: { 'a/b.md': 'old' },
    });

    const result = await writePolicy({
      client,
      name: 'a/b',
      content: 'new',
      at,
    });

    expect(result).toMatchObject({ written: true, created: false });
    expect(calls.copy).toEqual([
      ['a/b.md', 'archive/a/b.md/20260908T193000Z.md'],
    ]);
    expect(calls.upload).toEqual([{ path: 'a/b.md', upsert: true }]);
  });

  it('abandons the write when the archive copy fails', async () => {
    const { client, calls } = createMockClient({
      downloads: { 'a/b.md': 'old' },
      copyError: { message: 'archive is append-only' },
    });

    const result = await writePolicy({ client, name: 'a/b', content: 'new' });

    expect(result.written).toBe(false);
    expect(result.error).toContain('archive is append-only');
    expect(calls.upload).toEqual([]);
  });

  it('creates a new policy without archiving anything', async () => {
    const { client, calls } = createMockClient({ downloads: {} });

    const result = await writePolicy({ client, name: 'a/new', content: 'text' });

    expect(result).toMatchObject({ written: true, created: true });
    expect(result.archivedPath).toBeUndefined();
    expect(calls.copy).toEqual([]);
  });

  it('surfaces an upload failure', async () => {
    const { client } = createMockClient({
      downloads: {},
      uploadError: { message: 'row-level security' },
    });
    const result = await writePolicy({ client, name: 'a/new', content: 't' });
    expect(result).toMatchObject({ written: false, error: 'row-level security' });
  });
});
