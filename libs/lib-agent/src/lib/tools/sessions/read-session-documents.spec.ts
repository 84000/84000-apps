import { createReadSessionDocumentsTool } from './read-session-documents';
import type { DataClient } from '@eightyfourthousand/data-access';
import {
  hasPermission,
  listSessionDocuments,
  readSessionDocuments,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  SESSION_STAGES: ['stage0', 'stage1'],
  hasPermission: jest.fn(),
  listSessionDocuments: jest.fn(),
  readSessionDocuments: jest.fn(),
  invalidSessionFilenames: (filenames: string[]) =>
    filenames.filter((n) => !n || n.includes('/') || n === '..'),
  sessionToh: (input: string) =>
    /^toh\d+/.test(input.trim().toLowerCase())
      ? input.trim().toLowerCase()
      : undefined,
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
const mockedList = jest.mocked(listSessionDocuments);
const mockedRead = jest.mocked(readSessionDocuments);

describe('read-session-documents tool', () => {
  const client = {} as DataClient;
  const tool = createReadSessionDocumentsTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  const call = (args: Record<string, unknown>) =>
    tool.handler(args as never, extra);

  const text = (result: Awaited<ReturnType<typeof call>>) =>
    (result.content[0] as { text: string }).text;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHasPermission.mockResolvedValue(true);
  });

  it('refuses without harness.read', async () => {
    mockedHasPermission.mockResolvedValue(false);

    const result = await call({ toh: 'toh345' });

    expect(result.isError).toBe(true);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it('lists the tree when no names are given', async () => {
    mockedList.mockResolvedValue(['toh345/stage0/toh345_stage0.md']);

    const result = await call({ toh: 'toh345' });

    expect(JSON.parse(text(result))).toEqual({
      toh: 'toh345',
      documents: ['toh345/stage0/toh345_stage0.md'],
    });
  });

  it('reports a failed listing rather than an empty work', async () => {
    mockedList.mockResolvedValue(undefined);

    const result = await call({ toh: 'toh345' });

    expect(result.isError).toBe(true);
  });

  it('resolves names within a stage', async () => {
    const document = {
      path: 'toh345/stage0/toh345_stage0.md',
      filename: 'toh345_stage0.md',
      contentType: 'text/markdown',
      content: '# Stage 0',
    };
    mockedRead.mockResolvedValue({
      documents: [document],
      missing: [],
      failed: [],
    });

    const result = await call({
      toh: 'toh345',
      stage: 'stage0',
      names: ['toh345_stage0.md'],
    });

    expect(mockedRead).toHaveBeenCalledWith({
      client,
      paths: ['toh345/stage0/toh345_stage0.md'],
    });
    expect(JSON.parse(text(result))).toEqual({
      toh: 'toh345',
      stage: 'stage0',
      documents: [document],
    });
  });

  it('asks for a stage rather than guessing which one a name is in', async () => {
    const result = await call({ toh: 'toh345', names: ['toh345_stage0.md'] });

    expect(result.isError).toBe(true);
    expect(mockedRead).not.toHaveBeenCalled();
  });

  it('reports an unreadable document as an error, never as unsaved', async () => {
    mockedRead.mockResolvedValue({
      documents: [],
      missing: [],
      failed: [
        {
          path: 'toh345/stage0/toh345_stage0.md',
          error: 'network unreachable',
        },
      ],
    });

    const result = await call({
      toh: 'toh345',
      stage: 'stage0',
      names: ['toh345_stage0.md'],
    });

    expect(result.isError).toBe(true);
    expect(text(result)).toContain('do not treat them as unsaved');
  });

  it('refuses a work name that is not a Tohoku number', async () => {
    const result = await call({ toh: 'archive' });

    expect(result.isError).toBe(true);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it('rejects a name that is a path', async () => {
    const result = await call({
      toh: 'toh345',
      stage: 'stage0',
      names: ['../archive/x.md'],
    });

    expect(result.isError).toBe(true);
    expect(mockedRead).not.toHaveBeenCalled();
  });
});
