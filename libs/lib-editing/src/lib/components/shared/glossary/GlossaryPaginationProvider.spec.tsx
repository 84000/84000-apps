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

/** One copy of the panel, as `ThreeColumns` draws it per layout. */
const Copy = ({ hidden = false }: { hidden?: boolean }) => (
  <div hidden={hidden}>
    <GlossaryPaginationProvider workUuid="work-1" initialPage={page}>
      <div id="term-1" />
      <div id="term-2" />
    </GlossaryPaginationProvider>
  </div>
);

const scrollIntoView = jest.fn();
const getClientRects = Element.prototype.getClientRects;

beforeAll(() => {
  Element.prototype.scrollIntoView = scrollIntoView;
  // jsdom lays nothing out: count an element as drawn unless it sits in a
  // hidden layout copy.
  Element.prototype.getClientRects = function (this: Element) {
    return (this.closest('[hidden]') ? [] : [{}]) as unknown as DOMRectList;
  };
});

afterAll(() => {
  Element.prototype.getClientRects = getClientRects;
});

beforeEach(() => {
  scrollIntoView.mockClear();
  mockUpdatePanel.mockClear();
});

describe('GlossaryPaginationProvider hash navigation', () => {
  it('leaves the hash alone in a copy that is not drawn', async () => {
    render(<Copy hidden />);

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(mockUpdatePanel).not.toHaveBeenCalled();
  });

  // On mobile the sheet mounts after the hidden desktop copy has seen the hash.
  it('navigates in the copy on show when it mounts later', async () => {
    const { rerender } = render(<Copy hidden />);
    rerender(
      <>
        <Copy hidden />
        <Copy />
      </>,
    );

    await waitFor(() => expect(mockUpdatePanel).toHaveBeenCalledTimes(1));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(
      (scrollIntoView.mock.contexts[0] as Element).closest('[hidden]'),
    ).toBeNull();
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'right',
      state: { ...right, hash: undefined },
    });
  });
});
