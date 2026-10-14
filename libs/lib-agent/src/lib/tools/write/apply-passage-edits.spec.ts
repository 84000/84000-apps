import { z } from 'zod';
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
    {
      op: 'delete-text',
      passageUuid: 'p1',
      start: 14,
      end: 23,
      text: '[F.90.a] ',
    },
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
    applied: true,
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
    mockedApply.mockResolvedValue({
      ...applied,
      dryRun: true,
      applied: false,
    } as never);

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
      warnings: [{ passageUuid: 'p1', message: 'Dropped span a2.' }],
      error: 'Not in work work-1: p9',
    } as never);

    const result = await tool.handler(
      { workUuid: 'work-1', edits } as never,
      extra,
    );

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('p9');
    expect(text).toContain('Dropped span a2.');
  });

  it('requires the text a delete-text cuts', () => {
    const schema = z.object(tool.inputSchema as z.ZodRawShape);
    const [cutEdit] = edits;
    expect(schema.safeParse({ workUuid: 'w', edits: [cutEdit] }).success).toBe(
      true,
    );
    const { text: _text, ...withoutText } = cutEdit;
    expect(
      schema.safeParse({ workUuid: 'w', edits: [withoutText] }).success,
    ).toBe(false);
  });

  it('keeps the optional text an add-annotation names', () => {
    const schema = z.object(tool.inputSchema as z.ZodRawShape);
    const add = { ...edits[1], kind: 'glossary-instance', end: 18 };
    const parsed = schema.safeParse({
      workUuid: 'w',
      edits: [add, { ...add, text: 'lord' }],
    });
    expect(parsed.success).toBe(true);
    const [without, withText] = (parsed.data as { edits: { text?: string }[] })
      .edits;
    expect(without.text).toBeUndefined();
    expect(withText.text).toBe('lord');
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

  it('tells the caller to re-read when the outcome is unknown', async () => {
    mockedHasPermission.mockResolvedValue(true);
    mockedApply.mockResolvedValue({
      success: false,
      dryRun: false,
      applied: 'unknown',
      passages: [],
      warnings: [],
      error: 'The save may have been applied: fetch failed',
    } as never);

    const result = await tool.handler(
      { workUuid: 'work-1', edits } as never,
      extra,
    );

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { text: string }).text;
    expect(text).toContain('applied: "unknown"');
    expect(text).toContain('Re-read');
  });
});
