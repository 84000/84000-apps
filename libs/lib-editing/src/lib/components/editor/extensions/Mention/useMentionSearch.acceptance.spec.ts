/**
 * ED-1647 acceptance: `useMentionSearch` maps a search hit's `passageType` and
 * `passageToh` onto the result's `subtype` and `linkToh`, for passage hits
 * only.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { searchEntities } from '@eightyfourthousand/client-graphql';
import { useMentionSearch } from './useMentionSearch';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  searchEntities: jest.fn(),
}));

jest.mock('../../../shared', () => ({
  useNavigation: () => ({ uuid: 'work-1', toh: 'toh1' }),
}));

const mockSearch = searchEntities as unknown as jest.Mock;

const hit = (overrides: Record<string, unknown>) => ({
  uuid: 'e-1',
  type: 'passage',
  label: 'label',
  text: 'text',
  ...overrides,
});

const search = async (hits: unknown[]) => {
  mockSearch.mockResolvedValue(hits);
  const { result } = renderHook(() => useMentionSearch('note'));
  await waitFor(() => expect(result.current.results.length).toBeGreaterThan(0));
  return result.current.results as unknown as Record<string, unknown>[];
};

beforeEach(() => mockSearch.mockReset());

describe('useMentionSearch location mapping (ED-1647)', () => {
  it('criterion 1+2: a passage hit carries subtype and linkToh', async () => {
    const [r] = await search([
      hit({ passageType: 'endnotes', passageToh: 'toh12' }),
    ]);

    expect(r).toMatchObject({
      entity: 'e-1',
      linkType: 'passage',
      label: 'label',
      text: 'text',
      subtype: 'endnotes',
      linkToh: 'toh12',
    });
  });

  it('criterion 1: a passage hit with no Toh scope has no linkToh', async () => {
    const [r] = await search([hit({ passageType: 'introduction' })]);

    expect(r.subtype).toBe('introduction');
    expect(r.linkToh).toBeUndefined();
  });

  it.each(['work', 'glossary', 'bibliography', 'folio'])(
    'criterion 4: a %s hit carries neither subtype nor linkToh',
    async (type) => {
      const [r] = await search([hit({ type })]);

      expect(r).toMatchObject({ entity: 'e-1', linkType: type });
      expect(r.subtype).toBeUndefined();
      expect(r.linkToh).toBeUndefined();
    },
  );

  it('criterion 4: a non-passage hit ignores stray passage fields', async () => {
    const [r] = await search([
      hit({ type: 'glossary', passageType: 'endnotes', passageToh: 'toh12' }),
    ]);

    expect(r.subtype).toBeUndefined();
    expect(r.linkToh).toBeUndefined();
  });
});
