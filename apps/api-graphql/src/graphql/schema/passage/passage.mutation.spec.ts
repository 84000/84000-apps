import { savePassagesMutation } from './passage.mutation';
import type { GraphQLContext } from '../../context';

jest.mock('../../context', () => ({
  requireEditorEditPermission: jest.fn(async () => ({ ok: true })),
}));
jest.mock('@eightyfourthousand/data-access', () => ({
  savePassagesWithDeletions: jest.fn(),
}));

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  savePassagesWithDeletions: jest.Mock;
};

const ctx = { supabase: {} } as unknown as GraphQLContext;

const args = {
  passages: [
    {
      uuid: 'p1',
      workUuid: 'w1',
      content: 'text',
      label: '1.1',
      sort: 1,
      type: 'translation',
      annotations: [],
    },
  ],
};

describe('savePassagesMutation', () => {
  beforeEach(() => {
    dataAccess.savePassagesWithDeletions.mockReset();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('passes on a save whose answer was lost', async () => {
    dataAccess.savePassagesWithDeletions.mockResolvedValue({
      success: false,
      savedCount: 0,
      passages: [],
      renumberedPassages: [],
      error: 'The save may have been applied: fetch failed',
      outcomeUnknown: true,
    });

    expect(await savePassagesMutation(null, args, ctx)).toMatchObject({
      success: false,
      outcomeUnknown: true,
    });
  });

  // The commit's lost answer is reported as a value, so a throw came before
  // anything was written, and the client can keep its edits and retry.
  it('reports a save that threw as a failure, not an unknown outcome', async () => {
    dataAccess.savePassagesWithDeletions.mockRejectedValue(
      new TypeError("Cannot read properties of undefined (reading 'map')"),
    );

    const result = await savePassagesMutation(null, args, ctx);

    expect(result).toEqual({
      success: false,
      savedCount: 0,
      passages: [],
      renumberedPassages: [],
      error: "Cannot read properties of undefined (reading 'map')",
    });
  });
});
