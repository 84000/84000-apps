import { render, screen } from '@testing-library/react';
import { Work } from '@eightyfourthousand/data-access';
import { LeftPanel } from './LeftPanel';

// Both children are exercised by their own suites; here only the tab wiring matters.
jest.mock('./TableOfContents', () => ({
  TableOfContents: () => <div>Table of contents body</div>,
}));
jest.mock('./PublishChecksPanel', () => ({
  PublishChecksPanel: ({ workUuid }: { workUuid: string }) => (
    <div>{`Checks for ${workUuid}`}</div>
  ),
}));

const mockUpdatePanel = jest.fn();
jest.mock('./NavigationProvider', () => ({
  useNavigation: () => ({
    panels: { left: { open: true, tab: 'toc' } },
    toh: 'toh251',
    updatePanel: mockUpdatePanel,
    setToh: jest.fn(),
  }),
}));

jest.mock('./hooks/useTohToggle', () => ({ useTohToggle: () => undefined }));

const WORK = {
  uuid: 'w1',
  title: 'The Play in Full',
  toh: ['toh251'],
  publicationVersion: '1.0.0',
  pages: 10,
  restriction: false,
  section: 'Discourses',
} as Work;

beforeEach(() => {
  jest.clearAllMocks();
  // jsdom has no matchMedia, which useIsMobile subscribes to. Desktop is the case that
  // matters here; the mobile branch only adds padding.
  window.matchMedia = jest.fn().mockReturnValue({
    matches: false,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  }) as unknown as typeof window.matchMedia;
});

describe('LeftPanel', () => {
  it('offers the Publishing tab to editors', () => {
    render(<LeftPanel work={WORK} isEditor />);

    expect(screen.getByRole('tab', { name: 'Publishing' })).toBeTruthy();
  });

  it('hides the Publishing tab from readers', () => {
    // Publish validation is editor-only, and the query behind it requires editor.admin —
    // a reader would just see it fail.
    render(<LeftPanel work={WORK} />);

    expect(screen.queryByRole('tab', { name: 'Publishing' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Table of Contents' })).toBeTruthy();
  });

  it('does not run validation until the tab is opened', () => {
    // The contents tab is the default, and validation costs ~0.8 ms per passage, so it
    // must not run for everyone who opens a work.
    render(<LeftPanel work={WORK} isEditor />);

    expect(screen.queryByText('Checks for w1')).toBeNull();
  });
});
