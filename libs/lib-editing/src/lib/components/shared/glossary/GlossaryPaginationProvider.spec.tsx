import { render, waitFor } from '@testing-library/react';
import type { GlossaryTermsPage } from '@eightyfourthousand/client-graphql';

import { GlossaryPaginationProvider } from './GlossaryPaginationProvider';

// jsdom has no CSS.escape; the ids here need no escaping.
if (typeof CSS === 'undefined') {
  (globalThis as { CSS?: unknown }).CSS = { escape: (value: string) => value };
}

const mockUpdatePanel = jest.fn();
const right = { open: true, tab: 'glossary', hash: 'term-2' };

jest.mock('../NavigationProvider', () => ({
  useNavigation: () => ({ panels: { right }, updatePanel: mockUpdatePanel }),
}));
jest.mock('../hooks/usePaginationLoadTriggers', () => ({
  usePaginationLoadTriggers: () => ({
    loadMoreAtStartRef: { current: null },
    loadMoreAtEndRef: { current: null },
    startLoadRequest: 0,
    endLoadRequest: 0,
  }),
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getWorkGlossaryTerms: jest.fn(),
  getWorkGlossaryTermsAround: jest.fn(),
}));

const page = {
  terms: [],
  totalCount: 2,
} as unknown as GlossaryTermsPage;

const Panel = () => (
  <GlossaryPaginationProvider workUuid="work-1" initialPage={page}>
    <div id="term-1" />
    <div id="term-2" />
  </GlossaryPaginationProvider>
);

const scrollIntoView = jest.fn();

beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
});

beforeEach(() => {
  scrollIntoView.mockClear();
  mockUpdatePanel.mockClear();
});

describe('GlossaryPaginationProvider hash navigation', () => {
  it('scrolls to the term the hash names and clears it once', async () => {
    render(<Panel />);

    await waitFor(() => expect(mockUpdatePanel).toHaveBeenCalledTimes(1));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect((scrollIntoView.mock.contexts[0] as Element).id).toBe('term-2');
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'right',
      state: { ...right, hash: undefined },
    });
  });
});
