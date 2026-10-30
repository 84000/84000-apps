import { render, screen } from '@testing-library/react';

import { EditorBackMatterPage } from './EditorBackMatterPage';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(),
  getWorkGlossaryTerms: jest.fn(async () => ({
    terms: [],
    hasMoreAfter: false,
  })),
  getWorkBibliography: jest.fn(async () => []),
}));
jest.mock('@eightyfourthousand/lib-instr/static', () => ({
  isStaticFeatureEnabled: () => false,
}));
// Every dynamic import here is `StackTab`.
jest.mock(
  'next/dynamic',
  () => () => (props: { tab: string }) =>
    jest
      .requireActual('react')
      .createElement('div', { 'data-testid': `stack-${props.tab}` }),
);
jest.mock('../shared/NavigationProvider', () => ({
  useNavigation: () => ({
    panels: { right: { open: true } },
    updatePanel: jest.fn(),
  }),
}));
jest.mock('../shared/glossary', () => ({
  GlossaryTermList: () => null,
  GlossaryPaginationProvider: () => null,
}));
jest.mock('../shared/bibliography', () => ({
  BibliographyList: () =>
    jest
      .requireActual('react')
      .createElement('div', { 'data-testid': 'bibliography-list' }),
}));
jest.mock('./EditorProvider', () => ({
  useEditorState: () => ({ work: { uuid: 'w1' } }),
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
  getWorkBibliography: jest.Mock;
};

/** A work with one bibliography entry. */
const withBibliography = () =>
  clientGraphql.getWorkBibliography.mockResolvedValue([
    { heading: '', label: '', entries: [{ uuid: 'b1', html: '<p>x</p>' }] },
  ]);

/** A work whose abbreviations and endnotes number as given. */
const withAbbreviations = (count: number, notes = 0) => {
  const of = (type: string) =>
    Array.from(
      { length: type === 'abbreviations' ? count : notes },
      (_, i) => `${type}${i}`,
    );
  clientGraphql.getPassageMetaPage.mockImplementation(
    async ({ type, limit }: { type: string; limit: number }) => ({
      metas: of(type)
        .slice(0, limit)
        .map((uuid) => ({ uuid, label: '', sort: 0, type })),
      hasMoreAfter: false,
      hasMoreBefore: false,
    }),
  );
};

// jsdom has no matchMedia, which the panel's mobile check reads.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

beforeEach(() => {
  clientGraphql.getPassageMetaPage.mockReset();
  clientGraphql.getWorkBibliography.mockReset().mockResolvedValue([]);
});

describe('EditorBackMatterPage', () => {
  it.each([
    ['shows', 2, true],
    ['hides', 0, false],
  ])(
    '%s the Abbr tab for a work with %i abbreviations',
    async (_, count, shown) => {
      withAbbreviations(count);
      render(<EditorBackMatterPage />);

      // The panel replaces the skeleton once its reads are in.
      await screen.findByRole('tablist');
      expect(!!screen.queryByRole('tab', { name: 'Abbr' })).toBe(shown);
      expect(!!screen.queryByRole('tab', { name: 'Notes' })).toBe(false);
    },
  );

  it('asks only whether each stacked tab has passages', async () => {
    withAbbreviations(3);
    render(<EditorBackMatterPage />);

    await screen.findByRole('tablist');
    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'abbreviations', limit: 1 }),
    );
    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'endnotes', limit: 1 }),
    );
  });

  it('shows Notes for a work with endnotes', async () => {
    withAbbreviations(0, 4);
    render(<EditorBackMatterPage />);

    expect(await screen.findByRole('tab', { name: 'Notes' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Abbr' })).toBeNull();
  });

  it('edits the bibliography in a stack', async () => {
    withAbbreviations(0);
    withBibliography();
    render(<EditorBackMatterPage />);

    expect(await screen.findByRole('tab', { name: 'Biblio' })).toBeTruthy();
    expect(screen.getByTestId('stack-bibliography')).toBeTruthy();
    expect(screen.queryByTestId('bibliography-list')).toBeNull();
  });
});
