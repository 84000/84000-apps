import { act, renderHook } from '@testing-library/react';
import { searchEntities } from '@eightyfourthousand/client-graphql';

import { useMentionSearch } from './useMentionSearch';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  searchEntities: jest.fn(),
}));
jest.mock('../../../shared', () => ({
  useNavigation: () => ({ uuid: 'w-1', toh: 'toh517' }),
}));

const mockSearch = searchEntities as jest.MockedFunction<typeof searchEntities>;

describe('useMentionSearch', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("carries a passage's section and Toh, and nothing extra for other kinds", async () => {
    mockSearch.mockResolvedValue([
      {
        uuid: 'n-4',
        type: 'passage',
        label: 'n.4',
        text: 'Note',
        passageType: 'endnotes',
        passageToh: 'toh871',
      },
      {
        uuid: 'i-2',
        type: 'passage',
        label: 'i.2',
        text: 'Intro',
        passageType: 'introduction',
      },
      { uuid: 'g-1', type: 'glossary', label: 'g.1', text: 'Term' },
    ]);

    const { result } = renderHook(() => useMentionSearch('note'));
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(result.current.results).toEqual([
      {
        entity: 'n-4',
        linkType: 'passage',
        label: 'n.4',
        text: 'Note',
        subtype: 'endnotes',
        linkToh: 'toh871',
      },
      {
        entity: 'i-2',
        linkType: 'passage',
        label: 'i.2',
        text: 'Intro',
        subtype: 'introduction',
      },
      { entity: 'g-1', linkType: 'glossary', label: 'g.1', text: 'Term' },
    ]);
  });
});
