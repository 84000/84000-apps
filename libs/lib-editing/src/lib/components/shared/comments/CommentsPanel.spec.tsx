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
const mockNavigation: { focusedComment?: string } = {};
jest.mock('../NavigationProvider', () => ({
  useNavigation: () => ({
    focusedComment: mockNavigation.focusedComment,
    setFocusedComment: mockSetFocusedComment,
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
  { passageUuid: 'p1', label: '1.1', sort: 1, anchored, unanchored },
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
