import { applyGlossaryInstances, type GlossaryInstanceItem } from './apply';
import { applyPassageEdits, type PassageEdit } from '../passage/edits';
import type { GlossaryPassageState, ResolveAnnotation } from './read';
import type { DataClient } from '../types';

type AddEdit = Extract<PassageEdit, { op: 'add-annotation' }>;

jest.mock('../passage/edits', () => ({ applyPassageEdits: jest.fn() }));
const mocked = applyPassageEdits as jest.MockedFunction<
  typeof applyPassageEdits
>;

const client = {} as DataClient;
const TEXT = 'lorem ipsum dolor sit amet consectetur';
const item = (passageUuid: string, start = 0): GlossaryInstanceItem => ({
  passageUuid,
  start,
  end: start + 5,
  text: TEXT.slice(start, start + 5),
  termUuid: 't',
  authorityUuid: 'a',
});

const stored = (
  passageUuid: string,
  start: number,
  end: number,
  glossary = 't',
): ResolveAnnotation => ({
  uuid: `old-${passageUuid}-${start}`,
  passageUuid,
  type: 'glossary-instance',
  start,
  end,
  content: [{ uuid: glossary }],
});

/** Every passage reads as TEXT, with the given stored instances. */
const reader =
  (instances: ResolveAnnotation[] = [], content: Record<string, string> = {}) =>
  async (passageUuids: string[]): Promise<{ data: GlossaryPassageState }> => ({
    data: {
      content: new Map(
        passageUuids
          .filter((p) => p !== 'gone')
          .map((p) => [p, content[p] ?? TEXT]),
      ),
      instances: instances.filter((a) => passageUuids.includes(a.passageUuid)),
    },
  });

/** A save that stores every edit it is given, plus the instances already there. */
const saved = (
  applied: boolean | 'unknown' = true,
  success = applied === true,
) =>
  mocked.mockImplementationOnce(async ({ edits }) => {
    const byPassage = new Map<string, AddEdit[]>();
    for (const e of edits as AddEdit[])
      byPassage.set(e.passageUuid, [
        ...(byPassage.get(e.passageUuid) ?? []),
        e,
      ]);
    return {
      success,
      dryRun: false,
      applied,
      error: success ? undefined : 'boom',
      warnings: [],
      passages: [...byPassage].map(([uuid, list]) => ({
        uuid,
        content: TEXT,
        annotations: [
          {
            uuid: `old-${uuid}-30`,
            type: 'glossaryInstance',
            start: 30,
            end: 35,
            glossary: 't',
          },
          ...list.map((e, i) => ({
            uuid: `new-${uuid}-${i}`,
            type: 'glossaryInstance',
            start: (e as { start: number }).start,
            end: (e as { end: number }).end,
            glossary: 't',
          })),
        ],
      })),
    } as never;
  });

beforeEach(() => mocked.mockReset());

describe('applyGlossaryInstances', () => {
  it('saves a chunk of passages at a time as add-annotation edits', async () => {
    saved();
    saved();
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1', 10), item('p1', 20), item('p2', 10), item('p3', 10)],
      chunkPassages: 2,
      readState: reader([
        stored('p1', 30, 35),
        stored('p2', 30, 35),
        stored('p3', 30, 35),
      ]),
    });
    expect(mocked).toHaveBeenCalledTimes(2);
    expect(mocked.mock.calls[0][0].edits).toEqual([
      {
        op: 'add-annotation',
        passageUuid: 'p1',
        kind: 'glossary-instance',
        start: 10,
        end: 15,
        data: { glossary: 't', authority: 'a' },
      },
      expect.objectContaining({ passageUuid: 'p1', start: 20 }),
      expect.objectContaining({ passageUuid: 'p2', start: 10 }),
    ]);
    expect(result).toMatchObject({
      appliedInstances: 4,
      remainingInstances: 0,
    });
    expect(result.stopped).toBeUndefined();
    expect(result.chunks.map((c) => c.annotationUuids)).toEqual([
      ['new-p1-0', 'new-p1-1', 'new-p2-0'],
      ['new-p3-0'],
    ]);
  });

  it('re-reads each chunk and sends only items that still fit', async () => {
    saved();
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [
        item('p1', 0),
        item('p1', 6),
        item('p1', 12),
        { ...item('p1', 18), termUuid: 'child' },
        item('gone', 0),
      ],
      termOf: new Map([['child-name', 'child']]),
      readState: reader(
        [stored('p1', 8, 14), stored('p1', 18, 23, 'child-name')],
        { p1: 'XXXXX' + TEXT.slice(5) },
      ),
    });
    // 0: text changed; 6: overlaps a stored instance; 12: likewise;
    // 18: stored with the same term (cited by a child name); gone: no passage.
    expect(mocked).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      appliedInstances: 0,
      staleInstances: 2,
      skippedInstances: 2,
      alreadyApplied: 1,
      remainingInstances: 0,
    });
  });

  it('counts an item as already applied only when the stored instance is the only clash', async () => {
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1', 6)],
      readState: reader([stored('p1', 6, 11), stored('p1', 9, 14, 'x')]),
    });
    expect(result).toMatchObject({ alreadyApplied: 0, skippedInstances: 1 });
  });

  it('warns when the save wrote over text that changed after the re-read', async () => {
    mocked.mockResolvedValueOnce({
      success: true,
      dryRun: false,
      applied: true,
      warnings: [],
      passages: [
        {
          uuid: 'p1',
          content: 'XXXXX' + TEXT.slice(5),
          annotations: [
            {
              uuid: 'n1',
              type: 'glossaryInstance',
              start: 0,
              end: 5,
              glossary: 't',
            },
          ],
        },
      ],
    } as never);
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1', 0)],
      readState: reader(),
    });
    expect(result.appliedInstances).toBe(1);
    expect(result.warnings[0]).toMatch(/n1.*changed/);
  });

  it('never sends two overlapping items', async () => {
    saved();
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1', 0), { ...item('p1', 2), text: TEXT.slice(2, 7) }],
      readState: reader(),
    });
    expect(mocked.mock.calls[0][0].edits).toHaveLength(1);
    expect(result.skippedInstances).toBe(1);
  });

  it('stops at a failed chunk and leaves the rest unattempted', async () => {
    saved(false, false);
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1'), item('p2')],
      chunkPassages: 1,
      readState: reader(),
    });
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      stopped: 'failed',
      appliedInstances: 0,
      failedInstances: 1,
      remainingInstances: 1,
    });
    expect(result.chunks[0]).toMatchObject({
      applied: false,
      error: 'boom',
      annotationUuids: [],
    });
  });

  it('stops at an unknown outcome and counts the chunk as failed, not remaining', async () => {
    saved('unknown', false);
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1'), item('p2')],
      chunkPassages: 1,
      readState: reader(),
    });
    expect(result).toMatchObject({
      stopped: 'unknown',
      appliedInstances: 0,
      failedInstances: 1,
      remainingInstances: 1,
    });
  });

  it('stops a re-read failure before writing', async () => {
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1')],
      readState: async () => ({ error: 'down' }),
    });
    expect(mocked).not.toHaveBeenCalled();
    expect(result).toMatchObject({ stopped: 'read', remainingInstances: 1 });
  });

  it('stops when the time budget, counted from the start, runs out', async () => {
    saved();
    let t = 0;
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1'), item('p2')],
      chunkPassages: 1,
      budgetMs: 30,
      startedAt: 0,
      now: () => (t += 20),
      readState: reader(),
    });
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      stopped: 'budget',
      appliedInstances: 1,
      remainingInstances: 1,
    });
  });

  it('writes nothing when no budget is left', async () => {
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1')],
      budgetMs: 0,
      readState: reader(),
    });
    expect(mocked).not.toHaveBeenCalled();
    expect(result).toMatchObject({ stopped: 'budget', remainingInstances: 1 });
  });

  it('writes nothing on a dry run', async () => {
    mocked.mockResolvedValueOnce({
      success: true,
      dryRun: true,
      applied: false,
      warnings: [],
      passages: [],
    } as never);
    const result = await applyGlossaryInstances({
      client,
      workUuid: 'w',
      items: [item('p1')],
      dryRun: true,
      readState: reader(),
    });
    expect(mocked.mock.calls[0][0].dryRun).toBe(true);
    expect(result).toMatchObject({
      dryRun: true,
      appliedInstances: 0,
      remainingInstances: 0,
    });
  });
});
