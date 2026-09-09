import { createWriteSessionDocumentsTool } from './write-session-documents';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  hasPermission,
  prepareSessionUploads,
  resolveToh,
  writeSessionManifest,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  SESSION_STAGES: ['stage0', 'stage1'],
  hasPermission: jest.fn(),
  prepareSessionUploads: jest.fn(),
  writeSessionManifest: jest.fn(),
  resolveToh: jest.fn(),
  invalidSessionFilenames: (filenames: string[]) =>
    filenames.filter((n) => !n || n.includes('/') || n === '..'),
  sessionToh: (input: string) =>
    /^toh\d+/.test(input.trim().toLowerCase())
      ? input.trim().toLowerCase()
      : undefined,
  reservedWriteNames: (filenames: string[]) =>
    filenames.filter((n) => n === 'manifest.json'),
  sessionPath: ({
    toh,
    stage,
    filename,
  }: {
    toh: string;
    stage: string;
    filename: string;
  }) => `${toh}/${stage}/${filename}`,
}));

const mockedHasPermission = jest.mocked(hasPermission);
const mockedPrepare = jest.mocked(prepareSessionUploads);
const mockedManifest = jest.mocked(writeSessionManifest);
const mockedResolveToh = jest.mocked(resolveToh);

const upload = {
  path: 'toh345/stage1/toh345_stage1.docx',
  filename: 'toh345_stage1.docx',
  contentType:
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  uploadUrl: 'https://storage/upload',
  token: 'token',
};

describe('write-session-documents tool', () => {
  const client = {} as DataClient;
  const tool = createWriteSessionDocumentsTool(client, 'user-uuid');
  const extra = {} as Parameters<typeof tool.handler>[1];

  const args = {
    toh: 'toh345',
    stage: 'stage1',
    files: [{ filename: 'toh345_stage1.docx', role: 'primary' }],
  };

  const call = (overrides = {}) =>
    tool.handler({ ...args, ...overrides } as never, extra);

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHasPermission.mockResolvedValue(true);
    mockedPrepare.mockResolvedValue({ uploads: [upload] });
    mockedManifest.mockResolvedValue({
      path: 'toh345/stage1/manifest.json',
    });
    mockedResolveToh.mockResolvedValue([
      { workUuid: 'work-uuid' },
    ] as unknown as Awaited<ReturnType<typeof resolveToh>>);
  });

  it('refuses without harness.edit', async () => {
    mockedHasPermission.mockResolvedValue(false);

    const result = await call();

    expect(result.isError).toBe(true);
    expect(mockedPrepare).not.toHaveBeenCalled();
  });

  it('returns an upload url and content type per file', async () => {
    const result = await call();

    expect(JSON.parse((result.content[0] as { text: string }).text)).toEqual({
      toh: 'toh345',
      stage: 'stage1',
      uploads: [upload],
      manifestPath: 'toh345/stage1/manifest.json',
    });
  });

  it('stamps the manifest with the caller from the token, not the agent', async () => {
    await call({ model: { name: 'claude-opus-5' }, userUuid: 'spoofed' });

    expect(mockedManifest).toHaveBeenCalledWith(
      expect.objectContaining({
        userUuid: 'user-uuid',
        workUuid: 'work-uuid',
        files: [
          {
            filename: 'toh345_stage1.docx',
            contentType: upload.contentType,
            role: 'primary',
          },
        ],
      }),
    );
  });

  it('refuses a work name that is not a Tohoku number', async () => {
    const result = await call({ toh: 'archive' });

    expect(result.isError).toBe(true);
    expect(mockedPrepare).not.toHaveBeenCalled();
  });

  it('resolves the work from the toh rather than taking it from the agent', async () => {
    await call({ workUuid: 'spoofed-work' });

    expect(mockedResolveToh).toHaveBeenCalledWith({
      client,
      toh: 'toh345',
    });
    expect(mockedManifest).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: 'work-uuid' }),
    );
  });

  it('logs and records no work when a toh resolves to several, and still saves', async () => {
    // A number belongs to one work, so this is a catalogue anomaly rather than
    // something to resolve by picking one.
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {
      /* silence */
    });
    mockedResolveToh.mockResolvedValue([
      { workUuid: 'one' },
      { workUuid: 'two' },
    ] as unknown as Awaited<ReturnType<typeof resolveToh>>);

    const result = await call();

    expect(result.isError).toBeUndefined();
    expect(mockedManifest).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: undefined }),
    );
    expect(logged).toHaveBeenCalled();

    logged.mockRestore();
  });

  it('records no work for an uncatalogued toh, quietly, and still saves', async () => {
    const logged = jest.spyOn(console, 'error').mockImplementation(() => {
      /* silence */
    });
    mockedResolveToh.mockResolvedValue([]);

    const result = await call();

    expect(result.isError).toBeUndefined();
    expect(mockedManifest).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: undefined }),
    );
    expect(logged).not.toHaveBeenCalled();

    logged.mockRestore();
  });

  it('rejects a filename that is a path', async () => {
    const result = await call({
      files: [{ filename: '../archive/x.md', role: 'supporting' }],
    });

    expect(result.isError).toBe(true);
    expect(mockedPrepare).not.toHaveBeenCalled();
  });

  it('refuses to hand out an upload url for the manifest', async () => {
    const result = await call({
      files: [{ filename: 'manifest.json', role: 'supporting' }],
    });

    expect(result.isError).toBe(true);
    expect(mockedPrepare).not.toHaveBeenCalled();
  });

  it('rejects the same file listed twice', async () => {
    const result = await call({
      files: [
        { filename: 'a.md', role: 'primary' },
        { filename: 'a.md', role: 'supporting' },
      ],
    });

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('a.md');
    expect(mockedPrepare).not.toHaveBeenCalled();
  });

  it('surfaces a failed archive rather than handing out an upload url', async () => {
    mockedPrepare.mockResolvedValue({ error: 'archive is append-only' });

    const result = await call();

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'archive is append-only',
    );
    expect(mockedManifest).not.toHaveBeenCalled();
  });

  it('surfaces a failed manifest write', async () => {
    mockedManifest.mockResolvedValue({ error: 'row-level security' });

    const result = await call();

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'row-level security',
    );
  });
});
