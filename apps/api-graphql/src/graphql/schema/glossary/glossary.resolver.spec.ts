import type { GraphQLContext } from '../../context';
import { glossaryTermInstancesResolver } from './glossary.resolver';

const mockGetGlossaryTermInstances = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  getGlossaryTermInstances: (...args: unknown[]) =>
    mockGetGlossaryTermInstances(...args),
}));

const context = (source: 'draft' | 'published') =>
  ({ supabase: {}, source }) as unknown as GraphQLContext;

describe('glossaryTermInstancesResolver', () => {
  beforeEach(() => mockGetGlossaryTermInstances.mockReset());

  it('reads a page of the draft instances', async () => {
    const page = { items: [], totalCount: 0, offset: 50 };
    mockGetGlossaryTermInstances.mockResolvedValue(page);

    const result = await glossaryTermInstancesResolver(
      undefined,
      { uuid: 'term', toh: 'toh8', first: 50, offset: 50 },
      context('draft'),
    );

    expect(result).toBe(page);
    expect(mockGetGlossaryTermInstances).toHaveBeenCalledWith({
      client: {},
      uuid: 'term',
      toh: 'toh8',
      first: 50,
      offset: 50,
    });
  });

  it('reads nothing for a published-content request', async () => {
    const result = await glossaryTermInstancesResolver(
      undefined,
      { uuid: 'term' },
      context('published'),
    );

    expect(result).toBeNull();
    expect(mockGetGlossaryTermInstances).not.toHaveBeenCalled();
  });
});
