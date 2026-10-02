import { render, screen, waitFor } from '@testing-library/react';

import { EditorBackMatterPage } from './EditorBackMatterPage';

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: jest.fn(() => ({})),
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
jest.mock('next/dynamic', () => () => () => null);
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
jest.mock('../shared/bibliography', () => ({ BibliographyList: () => null }));
jest.mock('./EditorProvider', () => ({
  useEditorState: () => ({ work: { uuid: 'w1' } }),
}));

const mockFlag = { enabled: false, ready: false };
jest.mock('./usePerPassageDocs', () => ({
  usePerPassageDocs: () => mockFlag,
}));

const clientGraphql = jest.requireMock(
  '@eightyfourthousand/client-graphql',
) as { getTranslationBlocks: jest.Mock };

/** A work whose abbreviations number `count`. */
const withAbbreviations = (count: number) =>
  clientGraphql.getTranslationBlocks.mockImplementation(
    async ({ type }: { type: string }) => ({
      blocks:
        type === 'abbreviations'
          ? Array.from({ length: count }, (_, i) => ({
              type: 'passage',
              attrs: { uuid: `a${i}` },
            }))
          : [],
      hasMoreAfter: false,
    }),
  );

// jsdom has no matchMedia, which the panel's mobile check reads.
window.matchMedia = ((query: string) => ({
  matches: false,
  media: query,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

beforeEach(() => {
  clientGraphql.getTranslationBlocks.mockReset();
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
    },
  );
});
