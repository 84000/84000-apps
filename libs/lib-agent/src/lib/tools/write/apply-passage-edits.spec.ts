import { createApplyPassageEditsTool } from './apply-passage-edits';
import type { DataClient } from '@eightyfourthousand/data-access';

import {
  applyPassageEdits,
  hasPermission,
} from '@eightyfourthousand/data-access';

jest.mock('@eightyfourthousand/data-access', () => ({
  applyPassageEdits: jest.fn(),
  hasPermission: jest.fn(),
}));

const mockedApply = jest.mocked(applyPassageEdits);
const mockedHasPermission = jest.mocked(hasPermission);

describe('apply-passage-edits tool', () => {
  const client = {} as DataClient;
  const tool = createApplyPassageEditsTool(client);
  const extra = {} as Parameters<typeof tool.handler>[1];

  const edits = [
    { op: 'delete-text', passageUuid: 'p1', start: 14, end: 23 },
    {
      op: 'add-annotation',
      passageUuid: 'p1',
      kind: 'mention',
      start: 14,
      data: { entity: 'f1', linkType: 'folio', isSameWork: true },
    },
  ];

  const applied = {
    success: true,
    dryRun: false,
    warnings: [],
    passages: [
      {
        uuid: 'p1',
        label: '1.10',
        sort: 548,
        content: 'Then the lord said this',
        annotations: [{ uuid: 'a1' }],
      },
    ],
  };

  beforeEach(() => jest.clearAllMocks());

  it('has correct metadata and is not read-only', () => {
    expect(tool.name).toBe('apply-passage-edits');
    expect(tool.annotations?.readOnlyHint).toBe(false);
    expect(tool.annotations?.destructiveHint).toBe(true);
  });

  it('denies callers without editor.edit and does not write', async () => {
    mockedHasPermission.mockResolvedValue(false);

    const result = await tool.handler(
      { workUuid: 'work-1', edits } as never,
      extra,
    );

    expect(mockedApply).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
  });

  it('passes the edits straight through to the data layer', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedApply.mockResolvedValue(applied as never);

    await tool.handler({ workUuid: 'work-1', edits } as never, extra);

    expect(mockedApply).toHaveBeenCalledWith({
      client,
      workUuid: 'work-1',
      edits,
      dryRun: undefined,
    });
  });

  it('reports a dry run as not applied', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedApply.mockResolvedValue({ ...applied, dryRun: true } as never);

    const result = await tool.handler(
      { workUuid: 'work-1', edits, dryRun: true } as never,
      extra,
    );

    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload).toMatchObject({ applied: false, dryRun: true });
  });

  it('summarises each passage rather than returning every annotation', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedApply.mockResolvedValue(applied as never);

    const result = await tool.handler(
      { workUuid: 'work-1', edits } as never,
      extra,
    );

    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload.passages[0]).toEqual({
      uuid: 'p1',
      label: '1.10',
      sort: 548,
      content: 'Then the lord said this',
      annotations: 1,
    });
  });

  it('surfaces a failure from the data layer as an error', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedApply.mockResolvedValue({
      success: false,
      dryRun: false,
      passages: [],
      warnings: [],
      error: 'Not in work work-1: p9',
    } as never);

    const result = await tool.handler(
      { workUuid: 'work-1', edits } as never,
      extra,
    );

    expect(result.isError).toBe(true);
    expect((result.content[0] as { text: string }).text).toContain('p9');
  });

  it('returns the warnings the edit produced', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedApply.mockResolvedValue({
      ...applied,
      warnings: [{ passageUuid: 'p1', message: 'Dropped span annotation a2.' }],
    } as never);

    const result = await tool.handler(
      { workUuid: 'work-1', edits } as never,
      extra,
    );

    const payload = JSON.parse((result.content[0] as { text: string }).text);
    expect(payload.warnings[0].message).toContain('a2');
  });
});
