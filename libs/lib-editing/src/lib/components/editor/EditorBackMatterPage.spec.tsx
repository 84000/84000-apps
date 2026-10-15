import { render, screen, waitFor } from '@testing-library/react';

import { EditorBackMatterPage } from './EditorBackMatterPage';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
  getPassageMetaPage: jest.fn(),
  getTranslationBlocks: jest.fn(),
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
jest.mock('.', () => ({ TranslationBuilder: () => null }));
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

const mockFlag = { enabled: false, ready: false };
jest.mock('./usePerPassageDocs', () => ({
  usePerPassageDocs: () => mockFlag,
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as {
  getPassageMetaPage: jest.Mock;
  getTranslationBlocks: jest.Mock;
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
  clientGraphql.getTranslationBlocks.mockImplementation(
    async ({ type }: { type: string }) => ({
      blocks: of(type).map((uuid) => ({ type: 'passage', attrs: { uuid } })),
      hasMoreAfter: false,
    }),
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
  clientGraphql.getTranslationBlocks.mockReset();
  clientGraphql.getPassageMetaPage.mockReset();
  clientGraphql.getWorkBibliography.mockReset().mockResolvedValue([]);
  mockFlag.enabled = false;
  mockFlag.ready = false;
});

describe('EditorBackMatterPage', () => {
  // The paginated editor must not wait on the flag to start reading.
  it('reads the abbreviations at mount, before the flag settles', async () => {
    withAbbreviations(1);
    render(<EditorBackMatterPage />);

    await waitFor(() =>
      expect(clientGraphql.getTranslationBlocks).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'abbreviations' }),
      ),
    );
  });

  it.each([
    ['shows', 2, true],
    ['hides', 0, false],
  ])(
    '%s the Abbr tab under the flag for a work with %i abbreviations',
    async (_, count, shown) => {
      mockFlag.enabled = true;
      mockFlag.ready = true;
      withAbbreviations(count);
      render(<EditorBackMatterPage />);

      // The panel replaces the skeleton once its reads are in.
      await screen.findByRole('tablist');
      expect(!!screen.queryByRole('tab', { name: 'Abbr' })).toBe(shown);
      expect(!!screen.queryByRole('tab', { name: 'Notes' })).toBe(false);
    },
  );

  it('asks only whether each stacked tab has passages', async () => {
    mockFlag.enabled = true;
    mockFlag.ready = true;
    withAbbreviations(3);
    render(<EditorBackMatterPage />);

    await screen.findByRole('tablist');
    expect(clientGraphql.getTranslationBlocks).not.toHaveBeenCalled();
    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'abbreviations', limit: 1 }),
    );
    expect(clientGraphql.getPassageMetaPage).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'endnotes', limit: 1 }),
    );
  });

  it('shows Notes under the flag for a work with endnotes', async () => {
    mockFlag.enabled = true;
    mockFlag.ready = true;
    withAbbreviations(0, 4);
    render(<EditorBackMatterPage />);

    expect(await screen.findByRole('tab', { name: 'Notes' })).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Abbr' })).toBeNull();
  });

  it('shows the tabs the probe finds once the flag settles on', async () => {
    withAbbreviations(2);
    // The page's content says there are no abbreviations; the probe, which
    // reads what the stack reads, says there are.
    clientGraphql.getTranslationBlocks.mockResolvedValue({
      blocks: [],
      hasMoreAfter: false,
    });
    const { rerender } = render(<EditorBackMatterPage />);
    await waitFor(() =>
      expect(clientGraphql.getPassageMetaPage).toHaveBeenCalled(),
    );

    mockFlag.enabled = true;
    mockFlag.ready = true;
    rerender(<EditorBackMatterPage />);

    expect(await screen.findByRole('tab', { name: 'Abbr' })).toBeTruthy();
  });

  it('ignores the probe once the flag settles off', async () => {
    withAbbreviations(2);
    clientGraphql.getTranslationBlocks.mockResolvedValue({
      blocks: [],
      hasMoreAfter: false,
    });
    const { rerender } = render(<EditorBackMatterPage />);
    await waitFor(() =>
      expect(clientGraphql.getPassageMetaPage).toHaveBeenCalled(),
    );

    mockFlag.ready = true;
    rerender(<EditorBackMatterPage />);

    await screen.findByRole('tablist');
    expect(screen.queryByRole('tab', { name: 'Abbr' })).toBeNull();
  });

  it('shows the Abbr tab from its content without the flag', async () => {
    mockFlag.ready = true;
    withAbbreviations(2);
    render(<EditorBackMatterPage />);

    await screen.findByRole('tablist');
    expect(screen.getByRole('tab', { name: 'Abbr' })).toBeTruthy();
    expect(clientGraphql.getPassageMetaPage).not.toHaveBeenCalled();
  });

  it('edits the bibliography in a stack under the flag', async () => {
    mockFlag.enabled = true;
    mockFlag.ready = true;
    withAbbreviations(0);
    withBibliography();
    render(<EditorBackMatterPage />);

    expect(await screen.findByRole('tab', { name: 'Biblio' })).toBeTruthy();
    expect(screen.getByTestId('stack-bibliography')).toBeTruthy();
    expect(screen.queryByTestId('bibliography-list')).toBeNull();
  });

  it('lists the bibliography read-only without the flag', async () => {
    mockFlag.ready = true;
    withAbbreviations(0);
    withBibliography();
    render(<EditorBackMatterPage />);

    expect(await screen.findByRole('tab', { name: 'Biblio' })).toBeTruthy();
    expect(screen.getByTestId('bibliography-list')).toBeTruthy();
    expect(screen.queryByTestId('stack-bibliography')).toBeNull();
  });
});
