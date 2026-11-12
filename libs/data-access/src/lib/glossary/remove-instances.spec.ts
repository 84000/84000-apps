import { removeGlossaryTermInstances } from './remove-instances';
import type { DataClient } from '../types';

const mockApplyPassageEdits = jest.fn();
jest.mock('../passage/edits', () => ({
  applyPassageEdits: (...args: unknown[]) => mockApplyPassageEdits(...args),
}));

const stored = (
  uuid: string,
  passage: string,
  overrides: Record<string, unknown> = {},
) => ({
  uuid,
  passage_uuid: passage,
  type: 'glossary-instance',
  content: [{ type: 'glossary' }, { uuid: 'term' }],
  ...overrides,
});

/**
 * Answers the instance read with `result`, and the passage read with every
 * passage it asks for, labelled, except those in `otherWork`.
 */
const clientReading = (
  result: { data: unknown; error: unknown },
  otherWork: string[] = [],
) => {
  const inFilter = jest.fn(() => Promise.resolve(result));
  const client = {
    from: (table: string) =>
      table === 'passages'
        ? {
            select: () => ({
              eq: () => ({
                in: (_: string, uuids: string[]) =>
                  Promise.resolve({
                    data: uuids
                      .filter((uuid) => !otherWork.includes(uuid))
                      .map((uuid) => ({ uuid, label: `label-${uuid}` })),
                    error: null,
                  }),
              }),
            }),
          }
        : { select: () => ({ in: inFilter }) },
  } as unknown as DataClient;
  return { client, inFilter };
};

const saved = (uuid: string) => ({
  success: true,
  applied: true,
  dryRun: false,
  passages: [{ uuid, content: 'text' }],
  warnings: [],
});

beforeEach(() => mockApplyPassageEdits.mockReset());

describe('removeGlossaryTermInstances', () => {
  it('saves each passage once, removing its instances', async () => {
    const { client } = clientReading({
      data: [stored('a1', 'p1'), stored('a2', 'p1'), stored('a3', 'p2')],
      error: null,
    });
    mockApplyPassageEdits.mockImplementation(async ({ edits }) =>
      saved(edits[0].passageUuid),
    );

    const result = await removeGlossaryTermInstances({
      client,
      workUuid: 'work',
      termUuid: 'term',
      annotationUuids: ['a1', 'a2', 'a3', 'a1'],
    });

    expect(mockApplyPassageEdits).toHaveBeenCalledTimes(2);
    expect(mockApplyPassageEdits).toHaveBeenCalledWith({
      client,
      workUuid: 'work',
      edits: [
        { op: 'remove-annotation', passageUuid: 'p1', annotationUuid: 'a1' },
        { op: 'remove-annotation', passageUuid: 'p1', annotationUuid: 'a2' },
      ],
    });
    expect(result.removed.sort()).toEqual(['a1', 'a2', 'a3']);
    expect(result.failed).toEqual([]);
    expect(result.passages.map((p) => p.uuid).sort()).toEqual(['p1', 'p2']);
  });

  it('keeps a failed passage’s instances and the others’ removals', async () => {
    const { client } = clientReading({
      data: [stored('a1', 'p1'), stored('a2', 'p2'), stored('a3', 'p3')],
      error: null,
    });
    mockApplyPassageEdits.mockImplementation(async ({ edits }) => {
      const passage = edits[0].passageUuid;
      if (passage === 'p2') {
        return {
          success: false,
          applied: false,
          passages: [],
          warnings: [],
          error: 'deadlock detected',
        };
      }
      if (passage === 'p3') {
        return {
          success: false,
          applied: 'unknown',
          passages: [],
          warnings: [],
          error: 'fetch failed',
        };
      }
      return saved(passage);
    });

    const result = await removeGlossaryTermInstances({
      client,
      workUuid: 'work',
      termUuid: 'term',
      annotationUuids: ['a1', 'a2', 'a3'],
    });

    expect(result.removed).toEqual(['a1']);
    expect(result.failed).toEqual(
      expect.arrayContaining([
        {
          passageUuid: 'p2',
          passageLabel: 'label-p2',
          annotationUuids: ['a2'],
          error: 'deadlock detected',
        },
        expect.objectContaining({
          passageUuid: 'p3',
          annotationUuids: ['a3'],
          error: expect.stringContaining('may have been applied'),
        }),
      ]),
    );
  });

  it('reports a passage whose save threw', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = clientReading({
      data: [stored('a1', 'p1')],
      error: null,
    });
    mockApplyPassageEdits.mockRejectedValue(new Error('boom'));

    const result = await removeGlossaryTermInstances({
      client,
      workUuid: 'work',
      termUuid: 'term',
      annotationUuids: ['a1'],
    });

    expect(result.failed).toEqual([
      expect.objectContaining({ passageUuid: 'p1', error: 'boom' }),
    ]);
    jest.restoreAllMocks();
  });

  it('removes nothing that is not an instance of the entry in the work, and counts one already gone', async () => {
    const { client } = clientReading(
      {
        data: [
          stored('a1', 'p1', { type: 'end-note-link' }),
          stored('a2', 'p2', { content: [{ uuid: 'other' }] }),
          stored('a3', 'p3'),
        ],
        error: null,
      },
      ['p3'],
    );

    const result = await removeGlossaryTermInstances({
      client,
      workUuid: 'work',
      termUuid: 'term',
      annotationUuids: ['a1', 'a2', 'a3', 'gone'],
    });

    expect(mockApplyPassageEdits).not.toHaveBeenCalled();
    expect(result.removed).toEqual(['gone']);
    expect(result.failed.flatMap((f) => f.annotationUuids).sort()).toEqual([
      'a1',
      'a2',
      'a3',
    ]);
  });

  it('attempts nothing for an empty or oversized request', async () => {
    const { client, inFilter } = clientReading({ data: [], error: null });
    const ask = (annotationUuids: string[]) =>
      removeGlossaryTermInstances({
        client,
        workUuid: 'work',
        termUuid: 'term',
        annotationUuids,
      });

    expect((await ask([])).error).toBeTruthy();
    expect(
      (await ask(Array.from({ length: 101 }, (_, i) => `a${i}`))).error,
    ).toBeTruthy();
    expect(inFilter).not.toHaveBeenCalled();
  });

  it('attempts nothing when the instances cannot be read', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const { client } = clientReading({ data: null, error: { message: 'x' } });

    const result = await removeGlossaryTermInstances({
      client,
      workUuid: 'work',
      termUuid: 'term',
      annotationUuids: ['a1'],
    });

    expect(result.error).toContain('x');
    expect(mockApplyPassageEdits).not.toHaveBeenCalled();
    jest.restoreAllMocks();
  });
});
