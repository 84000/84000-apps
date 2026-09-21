import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PassageComments } from '@eightyfourthousand/client-graphql';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { CommentsPanel } from './CommentsPanel';

const mockGetPassageComments = jest.fn<Promise<PassageComments[]>, unknown[]>();
const mockResolveComment = jest.fn();
const mockReplyToComment = jest.fn();

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getPassageComments: (...args: unknown[]) => mockGetPassageComments(...args),
  getCommentThread: jest.fn(),
  replyToComment: (...args: unknown[]) => mockReplyToComment(...args),
  resolveComment: (...args: unknown[]) => mockResolveComment(...args),
  updateComment: jest.fn(),
  deleteComment: jest.fn(),
}));

jest.mock('@eightyfourthousand/data-access', () => ({
  createBrowserClient: () => ({}),
  getSession: async () => ({ user: { id: 'u1' } }),
}));

const mockSetFocusedComment = jest.fn();
const mockUpdatePanel = jest.fn();
const mockNavigation: { focusedComment?: string } = {};
jest.mock('../NavigationProvider', () => ({
  useNavigation: () => ({
    focusedComment: mockNavigation.focusedComment,
    setFocusedComment: mockSetFocusedComment,
    updatePanel: mockUpdatePanel,
  }),
}));

jest.mock('./useVisiblePassageUuids', () => ({
  useVisiblePassageUuids: () => ['p1'],
}));

const thread = (
  uuid: string,
  overrides: Partial<CommentThread> = {},
): CommentThread => ({
  uuid,
  content: `body of ${uuid}`,
  author: { id: 'u1', displayName: 'Editor' },
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  replies: [],
  replyCount: 0,
  ...overrides,
});

const page = ({
  anchored = [],
  unanchored = [],
}: Partial<
  Pick<PassageComments, 'anchored' | 'unanchored'>
>): PassageComments[] => [
  {
    passageUuid: 'p1',
    label: '1.1',
    type: 'translation',
    sort: 1,
    anchored,
    unanchored,
  },
];

const anchorRules = () => {
  const el = document.getElementById(
    'comment-anchor-styles',
  ) as HTMLStyleElement | null;
  return [...(el?.sheet?.cssRules ?? [])].map((r) => r.cssText).join(' ');
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation.focusedComment = undefined;
  Element.prototype.scrollIntoView = jest.fn();
  mockGetPassageComments.mockResolvedValue([]);
});

describe('CommentsPanel', () => {
  it('shows a thread beside the passage it annotates', async () => {
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('t1'),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);

    expect(await screen.findByText('body of t1')).toBeTruthy();
    expect(screen.getByText('1.1')).toBeTruthy();
  });

  it('keeps an unanchored thread reachable in its own section', async () => {
    // A thread outlives its anchor on purpose: an anchor can vanish from a
    // serialization gap as easily as from a deliberate unmark.
    mockGetPassageComments.mockResolvedValue(
      page({ unanchored: [thread('gone')] }),
    );

    render(<CommentsPanel workUuid="w1" />);

    expect(await screen.findByText('body of gone')).toBeTruthy();
    expect(
      screen.getByText(/Unanchored — no longer attached to any text/),
    ).toBeTruthy();
  });

  it('takes the mark off a resolved thread it is not listing, and puts it back', async () => {
    // The text and the panel say the same thing: a thread the panel is hiding
    // leaves no marking behind for someone to click.
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('done', { resolvedAt: '2026-09-02T00:00:00Z' }),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
          {
            thread: thread('live'),
            anchors: [{ uuid: 'a2', passageUuid: 'p1', start: 8, end: 12 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);
    await screen.findByText('body of live');

    expect(anchorRules()).toContain('[comment="done"]');
    expect(anchorRules()).not.toContain('[comment="live"]');

    await userEvent.click(
      screen.getByRole('button', { name: 'Show 1 resolved' }),
    );

    expect(anchorRules()).not.toContain('[comment="done"]');
  });

  it('keeps a focused resolved thread listed and marked', async () => {
    // A deep link to a resolved thread must not open an empty panel.
    mockNavigation.focusedComment = 'done';
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('done', { resolvedAt: '2026-09-02T00:00:00Z' }),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);

    expect(await screen.findByText('body of done')).toBeTruthy();
    expect(anchorRules()).not.toContain('background-color: transparent');
  });

  it('hides resolved threads until asked for them', async () => {
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('done', {
              resolvedAt: '2026-09-02T00:00:00Z',
              resolvedBy: { id: 'u2', displayName: 'Reviewer' },
            }),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);

    const toggle = await screen.findByRole('button', {
      name: 'Show 1 resolved',
    });
    expect(screen.queryByText('body of done')).toBeNull();

    await userEvent.click(toggle);

    expect(screen.getByText('body of done')).toBeTruthy();
  });

  it('brings the thread a mark click focused into view', async () => {
    mockNavigation.focusedComment = 't1';
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('t1'),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);
    await screen.findByText('body of t1');

    await waitFor(() =>
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled(),
    );
  });

  it('reports how many places a thread is anchored in', async () => {
    // A cross-passage selection or a split inside a commented range mints a
    // second anchor on one thread.
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('t1'),
            anchors: [
              { uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 },
              { uuid: 'a2', passageUuid: 'p1', start: 20, end: 24 },
            ],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);

    expect(await screen.findByText('2 places')).toBeTruthy();
  });

  it('offers one reply box per thread, however deep the thread is', async () => {
    const deep = thread('root', {
      replyCount: 1,
      replies: [thread('r1', { replyCount: 1, replies: [thread('r2')] })],
    });
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: deep,
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);
    await screen.findByText('body of root');

    // Every comment is shown; only the thread gets a reply box.
    expect(screen.getByText('body of r1')).toBeTruthy();
    expect(screen.getByText('body of r2')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Reply' })).toHaveLength(1);
  });

  it('files a reply against the thread root rather than the last entry', async () => {
    // A read nests two levels by default, so chaining would truncate an
    // ordinary conversation on every load.
    const deep = thread('root', { replies: [thread('r1')], replyCount: 1 });
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: deep,
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );
    mockReplyToComment.mockResolvedValue({ success: true });

    render(<CommentsPanel workUuid="w1" />);
    await screen.findByText('body of root');

    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));
    await userEvent.type(screen.getByRole('textbox'), 'Noted.');
    await userEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(mockReplyToComment).toHaveBeenCalledWith(
      expect.objectContaining({ parentUuid: 'root', content: 'Noted.' }),
    );
  });

  it('navigates to the passage a thread annotates, whatever tab is open', async () => {
    // Scrolling to the anchor did nothing when its passage was on a tab that
    // was not showing: the panels are React state, and a hidden row cannot be
    // scrolled into view.
    mockGetPassageComments.mockResolvedValue([
      {
        passageUuid: 'p9',
        label: 's.1',
        type: 'summary',
        sort: 2,
        anchored: [
          {
            thread: thread('t1'),
            anchors: [{ uuid: 'a1', passageUuid: 'p9', start: 0, end: 4 }],
          },
        ],
        unanchored: [],
      },
    ]);

    render(<CommentsPanel workUuid="w1" />);
    await userEvent.click(await screen.findByText('body of t1'));

    // A summary passage is read in the front matter, not the body.
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'main',
      state: { open: true, tab: 'front', hash: 'p9' },
    });
    expect(mockSetFocusedComment).toHaveBeenCalledWith('t1');
  });

  it('does not navigate for an unanchored thread', async () => {
    // There is nowhere to go: no anchor places it.
    mockGetPassageComments.mockResolvedValue(
      page({ unanchored: [thread('gone')] }),
    );

    render(<CommentsPanel workUuid="w1" />);
    await userEvent.click(await screen.findByText('body of gone'));

    expect(mockUpdatePanel).not.toHaveBeenCalled();
    expect(mockSetFocusedComment).toHaveBeenCalledWith('gone');
  });

  it('collapses a thread to the comment that opened it', async () => {
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('root', { replies: [thread('r1')], replyCount: 1 }),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);
    await screen.findByText('body of r1');

    await userEvent.click(screen.getByRole('button', { name: /Hide replies/ }));

    expect(screen.getByText('body of root')).toBeTruthy();
    expect(screen.queryByText('body of r1')).toBeNull();
    // The reply box goes with them: collapsed means the opening comment alone.
    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: /1 reply/ }));

    expect(screen.getByText('body of r1')).toBeTruthy();
  });

  it('offers no collapse control on a thread with no replies', async () => {
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('alone'),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);
    await screen.findByText('body of alone');

    expect(screen.queryByRole('button', { name: /replies/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reply' })).toBeTruthy();
  });

  it('re-reads after a resolve so the change shows immediately', async () => {
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('t1'),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );
    mockResolveComment.mockResolvedValue({ success: true });

    render(<CommentsPanel workUuid="w1" />);
    await screen.findByText('body of t1');
    mockGetPassageComments.mockClear();

    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(mockResolveComment).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 't1', resolved: true }),
    );
    await waitFor(() => expect(mockGetPassageComments).toHaveBeenCalled());
  });
});
