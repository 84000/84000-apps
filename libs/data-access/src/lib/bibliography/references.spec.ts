import type { DataClient } from '../types';
import { countBibliographyReferences } from './references';

const clientAnswering = (answer: () => Promise<unknown>) => {
  const calls: unknown[][] = [];
  const builder = {
    select: (...args: unknown[]) => (calls.push(['select', ...args]), builder),
    contains: (...args: unknown[]) => {
      calls.push(['contains', ...args]);
      return answer();
    },
  };
  return {
    client: { from: () => builder } as unknown as DataClient,
    calls,
  };
};

describe('countBibliographyReferences', () => {
  it('counts the annotations whose content names the row', async () => {
    const { client, calls } = clientAnswering(async () => ({
      count: 2,
      error: null,
    }));
    expect(await countBibliographyReferences({ client, uuid: 'b1' })).toBe(2);
    expect(calls).toContainEqual(['contains', 'content', '[{"uuid":"b1"}]']);
  });

  it('is null when the count fails or throws', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const failing = clientAnswering(async () => ({
      count: null,
      error: { message: 'no' },
    }));
    expect(
      await countBibliographyReferences({ client: failing.client, uuid: 'b1' }),
    ).toBeNull();
    const throwing = clientAnswering(async () => {
      throw new Error('offline');
    });
    expect(
      await countBibliographyReferences({
        client: throwing.client,
        uuid: 'b1',
      }),
    ).toBeNull();
  });
});
