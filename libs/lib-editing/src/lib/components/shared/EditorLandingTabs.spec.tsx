import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@eightyfourthousand/design-system';
import { Work } from '@eightyfourthousand/data-access';
import { EditorLandingTabs } from './EditorLandingTabs';

const mockGetPublishStatuses = jest.fn();
const mockGetTaggedComments = jest.fn();
const mockPush = jest.fn();

jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  getPublishStatuses: () => mockGetPublishStatuses(),
  getTaggedComments: (...args: unknown[]) => mockGetTaggedComments(...args),
  getPublishReadiness: jest.fn().mockResolvedValue({
    ok: true,
    errors: [],
    warnings: [],
  }),
}));

let mockSearchParams: URLSearchParams;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/translations/editor',
  useSearchParams: () => mockSearchParams,
}));

const WORKS: Work[] = [
  {
    uuid: 'w1',
    title: 'The Play in Full',
    toh: ['toh95'],
    publicationVersion: '1.0.0',
    pages: 10,
    restriction: false,
    section: 'Discourses',
  } as Work,
];

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = new URLSearchParams();
  mockGetPublishStatuses.mockResolvedValue([]);
  mockGetTaggedComments.mockResolvedValue([]);
  window.history.replaceState(null, '', '/translations/editor');
  window.localStorage.clear();
});

const renderTabs = () =>
  render(
    <TooltipProvider>
      <EditorLandingTabs works={WORKS} />
    </TooltipProvider>,
  );

const tab = (name: 'Translations' | 'Diagnostics' | 'Pending') =>
  screen.getByRole('tab', { name });

describe('EditorLandingTabs', () => {
  it('does not mount the diagnostics table until its tab is opened', async () => {
    // Diagnostics fetches cached statuses on mount, so opening the page must not pay for
    // it — nor should a reader of the work list trigger an editor-only query.
    renderTabs();

    expect(mockGetPublishStatuses).not.toHaveBeenCalled();

    await userEvent.click(tab('Diagnostics'));

    await waitFor(() =>
      expect(mockGetPublishStatuses).toHaveBeenCalledTimes(1),
    );
  });

  it('keeps both tables mounted once visited, so switching back does not refetch', async () => {
    // This is the cost of a tab switch. Radix unmounts inactive content by default, which
    // would rebuild a ~1000-row table and refire this query on every switch.
    renderTabs();

    await userEvent.click(tab('Diagnostics'));
    await waitFor(() =>
      expect(mockGetPublishStatuses).toHaveBeenCalledTimes(1),
    );

    await userEvent.click(tab('Translations'));
    await userEvent.click(tab('Diagnostics'));

    expect(mockGetPublishStatuses).toHaveBeenCalledTimes(1);
  });

  it('keeps the hidden table in the DOM rather than tearing it down', async () => {
    renderTabs();
    // "Published only" belongs to the translations table alone. Asserting on the work
    // title would prove nothing, since the diagnostics table lists the same works.
    expect(screen.getByText('Published only')).toBeTruthy();

    await userEvent.click(tab('Diagnostics'));
    await waitFor(() => expect(mockGetPublishStatuses).toHaveBeenCalled());

    expect(screen.getByText('Cannot publish only')).toBeTruthy();
    // Still present, just hidden — that is what makes switching back instant, and what
    // preserves each table's own search and sort state.
    expect(screen.getByText('Published only')).toBeTruthy();
  });

  it('mounts diagnostics directly when the URL asks for it', async () => {
    mockSearchParams = new URLSearchParams('view=diagnostics');

    renderTabs();

    await waitFor(() =>
      expect(mockGetPublishStatuses).toHaveBeenCalledTimes(1),
    );
  });

  it('lists works with pending comments and opens one filtered to them', async () => {
    mockGetTaggedComments.mockResolvedValue([
      {
        workUuid: 'w1',
        passageUuids: ['p1'],
        comment: {
          uuid: 'c1',
          content: '<p>Link Toh 123 once published</p>',
          createdAt: '2026-09-20T00:00:00Z',
        },
      },
    ]);
    renderTabs();

    await userEvent.click(tab('Pending'));

    expect(mockGetTaggedComments).toHaveBeenCalledWith(
      expect.objectContaining({ tag: 'pending' }),
    );
    expect(await screen.findByText('Link Toh 123 once published')).toBeTruthy();
    expect(window.location.search).toBe('?view=pending');

    await userEvent.click(screen.getByText('Link Toh 123 once published'));

    expect(mockPush).toHaveBeenCalledWith(
      '/translations/editor/w1?left=open:comments&comments=pending',
    );
  });

  it('opens on the Pending tab from the URL', async () => {
    mockSearchParams = new URLSearchParams('view=pending');
    renderTabs();

    expect(tab('Pending').getAttribute('aria-selected')).toBe('true');
    await waitFor(() => expect(mockGetTaggedComments).toHaveBeenCalled());
  });
});
