import { render, screen } from '@testing-library/react';
import type { GlossaryTermsPage } from '@eightyfourthousand/client-graphql';
import type { BibliographyEntries } from '@eightyfourthousand/data-access';
import { BackMatterPanel } from './BackMatterPanel';

// Each body has its own suite; here only the tab wiring matters.
jest.mock('./comments', () => ({
  CommentsPanel: ({ workUuid }: { workUuid: string }) => (
    <div>{`Comments for ${workUuid}`}</div>
  ),
}));
jest.mock('./glossary', () => ({
  GlossaryTermList: () => <div>Glossary body</div>,
  GlossaryPaginationProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}));
jest.mock('./bibliography', () => ({
  BibliographyList: () => <div>Bibliography body</div>,
}));

jest.mock('./NavigationProvider', () => ({
  useNavigation: () => ({
    panels: { right: { open: true, tab: 'endnotes' } },
    updatePanel: jest.fn(),
  }),
}));

jest.mock('./hooks/useScrollPositionRestore', () => ({
  useScrollPositionRestore: () => undefined,
}));

const EMPTY_GLOSSARY = {
  terms: [],
  hasMoreAfter: false,
} as unknown as GlossaryTermsPage;

const props = {
  workUuid: 'w1',
  endnotes: [{ type: 'paragraph' }],
  glossary: EMPTY_GLOSSARY,
  bibliography: [] as unknown as BibliographyEntries,
  abbreviations: [],
  renderTranslation: () => <div>Translation body</div>,
} as unknown as Parameters<typeof BackMatterPanel>[0];

beforeEach(() => {
  // jsdom has no matchMedia, which useIsMobile subscribes to.
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
});

describe('BackMatterPanel', () => {
  it('offers the Comments tab to editors', () => {
    render(<BackMatterPanel {...props} isEditor />);

    expect(screen.getByRole('tab', { name: 'Comments' })).toBeTruthy();
  });

  it('hides the Comments tab from readers', () => {
    // Comments are draft-only editorial working material and never reach a
    // published version, so a reader has nothing to read there.
    render(<BackMatterPanel {...props} />);

    expect(screen.queryByRole('tab', { name: 'Comments' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Notes' })).toBeTruthy();
  });

  it('does not read comments until the tab is opened', () => {
    // Not forceMount, unlike the tabs beside it: the read costs a query per
    // passage set in view.
    render(<BackMatterPanel {...props} isEditor />);

    expect(screen.queryByText('Comments for w1')).toBeNull();
  });
});
