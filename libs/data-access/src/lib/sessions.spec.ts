import {
  invalidSessionNames,
  listSessionDocuments,
  prepareSessionUploads,
  readSessionDocument,
  readSessionDocuments,
  sessionPath,
  writeSessionManifest,
} from './sessions';
import {
  archivedObjectPath,
  contentTypeFor,
  isTextPath,
} from './storage-archive';
import type { DataClient } from './types';

type ListResult = { data: unknown; error: { message: string } | null };

type MockCalls = {
  list: string[];
  download: string[];
  copy: [string, string][];
  upload: { path: string; contentType?: string }[];
  signUpload: string[];
  signDownload: string[];
};

const createMockClient = ({
  lists = {},
  downloads = {},
  copyError = null,
  uploadError = null,
  signUploadError = null,
  signDownloadError = null,
}: {
  lists?: Record<string, ListResult>;
  downloads?: Record<string, string>;
  copyError?: { message: string } | null;
  uploadError?: { message: string } | null;
  signUploadError?: { message: string } | null;
  signDownloadError?: { message: string } | null;
}) => {
  const calls: MockCalls = {
    list: [],
    download: [],
    copy: [],
    upload: [],
    signUpload: [],
    signDownload: [],
  };

  const client = {
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
          return { data: null, error: copyError };
        },
        // The body is not read back: jsdom's Blob does not implement `.text()`,
        // and the manifest is asserted through the returned value instead.
        upload: async (
          path: string,
          _body: Blob,
          opts?: { contentType?: string },
        ) => {
          calls.upload.push({ path, contentType: opts?.contentType });
          return { data: null, error: uploadError };
        },
        createSignedUploadUrl: async (path: string) => {
          calls.signUpload.push(path);
          return signUploadError
            ? { data: null, error: signUploadError }
            : {
                data: {
                  signedUrl: `https://storage/upload/${path}`,
                  token: `token-${path}`,
                  path,
                },
                error: null,
              };
        },
        createSignedUrl: async (path: string) => {
          calls.signDownload.push(path);
          return signDownloadError
            ? { data: null, error: signDownloadError }
            : {
                data: { signedUrl: `https://storage/get/${path}` },
                error: null,
              };
        },
      }),
    },
  } as unknown as DataClient;

  return { client, calls };
};

const folder = (name: string) => ({ id: null, name });
const file = (name: string) => ({ id: name, name });

describe('session paths', () => {
  it('keys a document by work, then stage, then the filename the skill made', () => {
    expect(
      sessionPath({
        toh: 'toh345',
        stage: 'stage1',
        filename: 'toh345_stage1.docx',
      }),
    ).toBe('toh345/stage1/toh345_stage1.docx');
  });

  it('keeps the real extension on the archived revision', () => {
    const at = new Date('2026-09-08T19:30:00.000Z');
    expect(
      archivedObjectPath({ path: 'toh345/stage1/toh345_stage1.docx', at }),
    ).toBe('archive/toh345/stage1/toh345_stage1.docx/20260908T193000Z.docx');
  });

  it('types a document by its extension', () => {
    expect(contentTypeFor('a/b.docx')).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(contentTypeFor('a/b.md')).toBe('text/markdown');
    expect(contentTypeFor('a/b')).toBe('application/octet-stream');
    expect(isTextPath('a/b.md')).toBe(true);
    expect(isTextPath('a/b.docx')).toBe(false);
  });

  it('refuses a filename that would climb out of its folder', () => {
    expect(
      invalidSessionNames({
        toh: 'toh345',
        filenames: ['toh345_stage1.md', '../archive/x.md', 'a/b.md', '..'],
      }),
    ).toEqual(['../archive/x.md', 'a/b.md', '..']);
  });
});

describe('listSessionDocuments', () => {
  it('lists a work across its stages', async () => {
    const { client } = createMockClient({
      lists: {
        toh345: { data: [folder('stage0'), folder('stage1')], error: null },
        'toh345/stage0': { data: [file('toh345_stage0.md')], error: null },
        'toh345/stage1': {
          data: [file('toh345_stage1.docx'), file('toh345_stage1.md')],
          error: null,
        },
      },
    });

    expect(await listSessionDocuments({ client, toh: 'toh345' })).toEqual([
      'toh345/stage0/toh345_stage0.md',
      'toh345/stage1/toh345_stage1.docx',
      'toh345/stage1/toh345_stage1.md',
    ]);
  });

  it('lists one stage when asked for one', async () => {
    const { client, calls } = createMockClient({
      lists: {
        'toh345/stage0': { data: [file('toh345_stage0.md')], error: null },
      },
    });

    expect(
      await listSessionDocuments({ client, toh: 'toh345', stage: 'stage0' }),
    ).toEqual(['toh345/stage0/toh345_stage0.md']);
    expect(calls.list).toEqual(['toh345/stage0']);
  });

  it('returns undefined rather than an empty list when the listing fails', async () => {
    const { client } = createMockClient({
      lists: { toh345: { data: null, error: { message: 'denied' } } },
    });
    expect(
      await listSessionDocuments({ client, toh: 'toh345' }),
    ).toBeUndefined();
  });
});

describe('readSessionDocument', () => {
  it('returns markdown inline, which is what a later stage reads', async () => {
    const { client } = createMockClient({
      downloads: { 'toh345/stage0/toh345_stage0.md': '# Stage 0' },
    });

    expect(
      await readSessionDocument({
        client,
        path: 'toh345/stage0/toh345_stage0.md',
      }),
    ).toEqual({
      path: 'toh345/stage0/toh345_stage0.md',
      filename: 'toh345_stage0.md',
      contentType: 'text/markdown',
      content: '# Stage 0',
    });
  });

  it('returns a docx as a download url rather than as bytes', async () => {
    const { client, calls } = createMockClient({});

    const result = await readSessionDocument({
      client,
      path: 'toh345/stage1/toh345_stage1.docx',
    });

    expect(result).toMatchObject({
      filename: 'toh345_stage1.docx',
      downloadUrl: 'https://storage/get/toh345/stage1/toh345_stage1.docx',
    });
    expect(calls.download).toEqual([]);
  });

  it('reports the documents it could not resolve without losing the rest', async () => {
    const { client } = createMockClient({
      downloads: { 'toh345/stage0/a.md': 'kept' },
    });

    expect(
      await readSessionDocuments({
        client,
        paths: ['toh345/stage0/a.md', 'toh345/stage0/missing.md'],
      }),
    ).toEqual({
      documents: [
        {
          path: 'toh345/stage0/a.md',
          filename: 'a.md',
          contentType: 'text/markdown',
          content: 'kept',
        },
      ],
      missing: ['toh345/stage0/missing.md'],
    });
  });
});

describe('prepareSessionUploads', () => {
  const at = new Date('2026-09-08T19:30:00.000Z');
  const paths = [
    'toh345/stage1/toh345_stage1.docx',
    'toh345/stage1/toh345_stage1.md',
  ];

  it('signs one url per file, with the content type the client must send', async () => {
    const { client, calls } = createMockClient({});

    const { uploads } = await prepareSessionUploads({ client, paths, at });

    expect(uploads).toEqual([
      {
        path: 'toh345/stage1/toh345_stage1.docx',
        filename: 'toh345_stage1.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadUrl: 'https://storage/upload/toh345/stage1/toh345_stage1.docx',
        token: 'token-toh345/stage1/toh345_stage1.docx',
      },
      {
        path: 'toh345/stage1/toh345_stage1.md',
        filename: 'toh345_stage1.md',
        contentType: 'text/markdown',
        uploadUrl: 'https://storage/upload/toh345/stage1/toh345_stage1.md',
        token: 'token-toh345/stage1/toh345_stage1.md',
      },
    ]);
    expect(calls.copy).toEqual([]);
  });

  it('archives the revision each url will replace', async () => {
    const { client, calls } = createMockClient({
      lists: {
        'toh345/stage1': {
          data: [file('toh345_stage1.docx'), file('toh345_stage1.md')],
          error: null,
        },
      },
    });

    const { uploads } = await prepareSessionUploads({ client, paths, at });

    expect(calls.copy).toEqual([
      [
        'toh345/stage1/toh345_stage1.docx',
        'archive/toh345/stage1/toh345_stage1.docx/20260908T193000Z.docx',
      ],
      [
        'toh345/stage1/toh345_stage1.md',
        'archive/toh345/stage1/toh345_stage1.md/20260908T193000Z.md',
      ],
    ]);
    expect(uploads?.[0].archivedPath).toBe(
      'archive/toh345/stage1/toh345_stage1.docx/20260908T193000Z.docx',
    );
  });

  it('authorizes nothing at all when one archive copy fails', async () => {
    const { client, calls } = createMockClient({
      lists: {
        'toh345/stage1': {
          data: [file('toh345_stage1.docx'), file('toh345_stage1.md')],
          error: null,
        },
      },
      copyError: { message: 'archive is append-only' },
    });

    const result = await prepareSessionUploads({ client, paths, at });

    expect(result.uploads).toBeUndefined();
    expect(result.error).toContain('archive is append-only');
    expect(calls.signUpload).toEqual([]);
  });

  it('surfaces a refused signature rather than reporting success', async () => {
    const { client } = createMockClient({
      signUploadError: { message: 'row-level security' },
    });

    const result = await prepareSessionUploads({ client, paths, at });

    expect(result.uploads).toBeUndefined();
    expect(result.error).toContain('row-level security');
  });
});

describe('writeSessionManifest', () => {
  const at = new Date('2026-09-08T19:30:00.000Z');

  const args = {
    toh: 'toh345',
    stage: 'stage1' as const,
    files: [
      {
        filename: 'toh345_stage1.docx',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        role: 'primary' as const,
      },
    ],
    userUuid: 'user-uuid',
    at,
  };

  it('stamps identity and time itself rather than taking them from the caller', async () => {
    const { client, calls } = createMockClient({});

    const result = await writeSessionManifest({
      client,
      ...args,
      model: { name: 'claude-opus-5' },
    });

    expect(result.path).toBe('toh345/stage1/manifest.json');
    expect(calls.upload[0].contentType).toBe('application/json');
    expect(result.manifest).toEqual({
      toh: 'toh345',
      stage: 'stage1',
      files: args.files,
      model: { name: 'claude-opus-5' },
      userUuid: 'user-uuid',
      timestamp: '2026-09-08T19:30:00.000Z',
    });
  });

  it('archives the manifest of the previous run', async () => {
    const { client, calls } = createMockClient({
      lists: {
        'toh345/stage1': { data: [file('manifest.json')], error: null },
      },
    });

    await writeSessionManifest({ client, ...args });

    expect(calls.copy).toEqual([
      [
        'toh345/stage1/manifest.json',
        'archive/toh345/stage1/manifest.json/20260908T193000Z.json',
      ],
    ]);
  });

  it('does not write when the previous manifest could not be archived', async () => {
    const { client, calls } = createMockClient({
      lists: {
        'toh345/stage1': { data: [file('manifest.json')], error: null },
      },
      copyError: { message: 'archive is append-only' },
    });

    const result = await writeSessionManifest({ client, ...args });

    expect(result.path).toBeUndefined();
    expect(result.error).toContain('archive is append-only');
    expect(calls.upload).toEqual([]);
  });
});
