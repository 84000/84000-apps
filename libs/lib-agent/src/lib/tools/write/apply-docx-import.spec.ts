import { createApplyDocxImportTool } from './apply-docx-import';
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  applyImportPreview: jest.fn(),
  hasPermission: jest.fn(),
}));

import { applyImportPreview, hasPermission } from '@eightyfourthousand/data-access';

const mockedApply = jest.mocked(applyImportPreview);
const mockedHasPermission = jest.mocked(hasPermission);

describe('apply-docx-import tool', () => {
  const client = {} as DataClient;
  const tool = createApplyDocxImportTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  const operations = [
    { kind: 'update_work', patch: { toh: 'toh44' } },
    {
      kind: 'insert_title',
      title: { content: 'The Blessed One', type: 'mainTitle', language: 'en' },
    },
    {
      kind: 'insert_passage',
      passage: { label: '1', type: 'translation', content: 'Thus have I heard.' },
      annotations: [],
    },
  ];

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata and is not read-only', () => {
    expect(tool.name).toBe('apply-docx-import');
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it('denies callers without editor.edit and does not write', async () => {
    mockedHasPermission.mockResolvedValue(false);

    const result = await tool.handler(
      { workUuid: 'work-1', operations } as never,
      extra,
    );

    expect(mockedHasPermission).toHaveBeenCalledWith({
      client,
      permission: 'editor.edit',
    });
    expect(mockedApply).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('applies operations and returns counts when permitted', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedApply.mockResolvedValue({
      counts: {
        workUpdates: 1,
        titles: 1,
        folioUpdates: 0,
        passages: 1,
        annotations: 0,
      },
      warnings: [],
    });

    const result = await tool.handler(
      { workUuid: 'work-1', operations } as never,
      extra,
    );

    expect(mockedApply).toHaveBeenCalledWith({
      client,
      workUuid: 'work-1',
      operations,
    });
    expect(result.isError).toBeUndefined();
    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload.applied).toBe(true);
    expect(payload.counts.passages).toBe(1);
  });

  it('surfaces persistence errors (e.g. non-empty target work)', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedApply.mockRejectedValue(
      new Error('Work work-1 already contains passages.'),
    );

    const result = await tool.handler(
      { workUuid: 'work-1', operations } as never,
      extra,
    );

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain(
      'already contains passages',
    );
  });
});
