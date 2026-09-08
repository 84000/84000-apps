import { createWriteSessionDocumentsTool } from './write-session-documents';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  hasPermission,
  prepareSessionUploads,
  writeSessionManifest,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  SESSION_STAGES: ['stage0', 'stage1'],
  hasPermission: jest.fn(),
  prepareSessionUploads: jest.fn(),
  writeSessionManifest: jest.fn(),
  invalidSessionNames: ({
    toh,
    filenames,
  }: {
    toh: string;
    filenames: string[];
  }) => [toh, ...filenames].filter((n) => !n || n.includes('/') || n === '..'),
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

  it('rejects a filename that is a path', async () => {
    const result = await call({
      files: [{ filename: '../archive/x.md', role: 'supporting' }],
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
