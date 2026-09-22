import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PassageComments } from '@eightyfourthousand/client-graphql';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { CommentsPanel } from './CommentsPanel';

const mockGetPassageComments = jest.fn<Promise<PassageComments[]>, unknown[]>();
const mockResolveComment = jest.fn();
const mockReplyToComment = jest.fn();
const mockDeleteComment = jest.fn();
const mockSetCommentTags = jest.fn();
const mockGetTaggedComments = jest.fn();

jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getPassageComments: (...args: unknown[]) => mockGetPassageComments(...args),
  getCommentThread: jest.fn(),
  replyToComment: (...args: unknown[]) => mockReplyToComment(...args),
  resolveComment: (...args: unknown[]) => mockResolveComment(...args),
  updateComment: jest.fn(),
  deleteComment: (...args: unknown[]) => mockDeleteComment(...args),
  setCommentTags: (...args: unknown[]) => mockSetCommentTags(...args),
  getTaggedComments: (...args: unknown[]) => mockGetTaggedComments(...args),
}));

jest.mock('@eightyfourthousand/data-access', () => ({
  COMMENT_TAG_SUGGESTIONS: ['pending'],
  MAX_COMMENT_TAG_LENGTH: 40,
  normalizeCommentTag: (tag: string) =>
    tag.trim().replace(/\s+/g, ' ').toLowerCase() || null,
  createBrowserClient: () => ({}),
  getSession: async () => ({ user: { id: 'u1' } }),
}));

const mockSetFocusedComment = jest.fn();
const mockUpdatePanel = jest.fn();
const mockRequestEditorFor = jest.fn();
const mockNavigation: { focusedComment?: string } = {};
jest.mock('../NavigationProvider', () => ({
  useNavigation: () => ({
    commentsRevision: 0,
    focusedComment: mockNavigation.focusedComment,
    requestEditorFor: mockRequestEditorFor,
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
  tags: [],
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

/** A rendered comment anchor, as the mark view draws one. */
const markInText = (commentUuid: string) => {
  const anchor = document.createElement('span');
  anchor.setAttribute('type', 'comment');
  anchor.setAttribute('comment', commentUuid);
  document.body.appendChild(anchor);
  return anchor;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation.focusedComment = undefined;
  Element.prototype.scrollIntoView = jest.fn();
  mockGetPassageComments.mockResolvedValue([]);
  mockDeleteComment.mockResolvedValue({ success: true, deletedUuids: [] });
  mockRequestEditorFor.mockResolvedValue(null);
  mockSetCommentTags.mockResolvedValue({ success: true });
  mockGetTaggedComments.mockResolvedValue([]);
  document.body.innerHTML = '';
  window.history.replaceState(null, '', '/');
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

    // The composer emits a fragment: a comment is stored as HTML.
    expect(mockReplyToComment).toHaveBeenCalledWith(
      expect.objectContaining({ parentUuid: 'root', content: '<p>Noted.</p>' }),
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

  it('renders a comment body as markup, not as characters', async () => {
    mockGetPassageComments.mockResolvedValue(
      page({
        anchored: [
          {
            thread: thread('t1', {
              content: '<p>First</p><p>Second</p>',
            }),
            anchors: [{ uuid: 'a1', passageUuid: 'p1', start: 0, end: 4 }],
          },
        ],
      }),
    );

    render(<CommentsPanel workUuid="w1" />);

    // Two paragraphs, not one line reading "<p>First</p><p>Second</p>".
    expect(await screen.findByText('First')).toBeTruthy();
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.queryByText(/<p>/)).toBeNull();
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

  it('counts a thread the text still marks as anchored, though the server has none', async () => {
    // A thread created from the editor carries its mark at once and its anchor
    // only at the next passage save. Listing it as unanchored in between would
    // tell the author their new comment is attached to nothing, while the text
    // beside it shows the highlight.
    markInText('fresh');
    mockGetPassageComments.mockResolvedValue(
      page({ unanchored: [thread('fresh')] }),
    );

    render(<CommentsPanel workUuid="w1" />);

    expect(await screen.findByText('body of fresh')).toBeTruthy();
    expect(
      screen.queryByText(/Unanchored — no longer attached to any text/),
    ).toBeNull();
  });

  it('takes the anchors off the text before deleting a thread', async () => {
    // The other order leaves a mark naming a thread that no longer exists —
    // which the panel cannot render and nobody can remove.
    const order: string[] = [];
    const unsetComment = jest.fn(() => order.push('unset'));
    mockRequestEditorFor.mockResolvedValue({ commands: { unsetComment } });
    mockDeleteComment.mockImplementation(async () => {
      order.push('delete');
      return { success: true, deletedUuids: ['t1'] };
    });

    markInText('t1');
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

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(mockDeleteComment).toHaveBeenCalled());
    expect(unsetComment).toHaveBeenCalledWith({ comment: 't1' });
    expect(order).toEqual(['unset', 'delete']);
  });

  describe('tags', () => {
    const anchoredAt = (uuid: string, passageUuid: string, extra = {}) => ({
      thread: thread(uuid, extra),
      anchors: [{ uuid: `a-${uuid}`, passageUuid, start: 0, end: 4 }],
    });

    it('shows a tag on the comment carrying it, reply included', async () => {
      mockGetPassageComments.mockResolvedValue(
        page({
          anchored: [
            anchoredAt('t1', 'p1', {
              replies: [thread('r1', { tags: ['pending'] })],
              replyCount: 1,
            }),
          ],
        }),
      );

      render(<CommentsPanel workUuid="w1" />);

      const chip = await screen.findByText('pending');
      expect(chip.closest('[data-comment-tag]')).toBeTruthy();
    });

    it('tags a reply from the suggestions', async () => {
      mockGetPassageComments.mockResolvedValue(
        page({
          anchored: [
            anchoredAt('t1', 'p1', {
              replies: [thread('r1')],
              replyCount: 1,
            }),
          ],
        }),
      );

      render(<CommentsPanel workUuid="w1" />);
      await screen.findByText('body of r1');

      const [, onReply] = screen.getAllByRole('button', { name: '+ Tag' });
      await userEvent.click(onReply);
      await userEvent.click(screen.getByRole('button', { name: 'pending' }));

      expect(mockSetCommentTags).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: 'r1', tags: ['pending'] }),
      );
    });

    it('tags with any value typed, normalized, alongside existing tags', async () => {
      mockGetPassageComments.mockResolvedValue(
        page({ anchored: [anchoredAt('t1', 'p1', { tags: ['pending'] })] }),
      );

      render(<CommentsPanel workUuid="w1" />);

      await userEvent.click(
        await screen.findByRole('button', { name: '+ Tag' }),
      );
      // Already carried, so not suggested again.
      expect(screen.queryByRole('button', { name: 'pending' })).toBeNull();
      await userEvent.type(
        screen.getByRole('textbox', { name: 'New tag' }),
        '  Link Toh 123{Enter}',
      );

      expect(mockSetCommentTags).toHaveBeenCalledWith(
        expect.objectContaining({
          uuid: 't1',
          tags: ['pending', 'link toh 123'],
        }),
      );
      expect(mockSetFocusedComment).not.toHaveBeenCalled();
    });

    it('does not write when the input is dismissed', async () => {
      mockGetPassageComments.mockResolvedValue(
        page({ anchored: [anchoredAt('t1', 'p1')] }),
      );

      render(<CommentsPanel workUuid="w1" />);

      await userEvent.click(
        await screen.findByRole('button', { name: '+ Tag' }),
      );
      await userEvent.type(
        screen.getByRole('textbox', { name: 'New tag' }),
        'draft{Escape}',
      );

      expect(mockSetCommentTags).not.toHaveBeenCalled();
      expect(screen.getByRole('button', { name: '+ Tag' })).toBeTruthy();
    });

    it('untags from the chip', async () => {
      mockGetPassageComments.mockResolvedValue(
        page({ anchored: [anchoredAt('t1', 'p1', { tags: ['pending'] })] }),
      );

      render(<CommentsPanel workUuid="w1" />);

      await userEvent.click(
        await screen.findByRole('button', { name: 'Remove pending' }),
      );

      expect(mockSetCommentTags).toHaveBeenCalledWith(
        expect.objectContaining({ uuid: 't1', tags: [] }),
      );
      expect(mockSetFocusedComment).not.toHaveBeenCalled();
    });

    it('lists every thread in the work carrying the filter tag, not only those in view', async () => {
      mockGetTaggedComments.mockResolvedValue([
        { workUuid: 'w1', threadUuid: 't9', passageUuids: ['p9'] },
      ]);
      mockGetPassageComments.mockImplementation(async (...args: unknown[]) =>
        (args[0] as { passageUuids: string[] }).passageUuids.includes('p9')
          ? [
              {
                passageUuid: 'p9',
                label: '9.1',
                type: 'translation',
                sort: 9,
                anchored: [anchoredAt('t9', 'p9'), anchoredAt('t8', 'p9')],
                unanchored: [],
              },
            ]
          : page({ anchored: [anchoredAt('t1', 'p1')] }),
      );

      render(<CommentsPanel workUuid="w1" />);
      await screen.findByText('body of t1');

      await userEvent.click(
        await screen.findByRole('button', { name: 'Filter by tag' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'pending' }));

      expect(await screen.findByText('body of t9')).toBeTruthy();
      expect(screen.queryByText('body of t8')).toBeNull();
      expect(screen.queryByText('body of t1')).toBeNull();
    });

    it('opens filtered when the URL names a tag', async () => {
      window.history.replaceState(null, '', '/?commentTag=Pending');
      mockGetTaggedComments.mockResolvedValue([]);

      render(<CommentsPanel workUuid="w1" />);

      expect(
        await screen.findByText('No comments tagged “pending” in this work.'),
      ).toBeTruthy();
      expect(mockGetTaggedComments).toHaveBeenCalledWith(
        expect.objectContaining({ tag: 'pending', workUuid: 'w1' }),
      );
    });

    it('filters by any tag typed, and suggests tags already in view', async () => {
      mockGetPassageComments.mockResolvedValue(
        page({
          anchored: [anchoredAt('t1', 'p1', { tags: ['needs source'] })],
        }),
      );

      render(<CommentsPanel workUuid="w1" />);
      await screen.findByText('body of t1');

      await userEvent.click(
        screen.getByRole('button', { name: 'Filter by tag' }),
      );
      expect(screen.getByRole('button', { name: 'pending' })).toBeTruthy();
      expect(screen.getByRole('button', { name: 'needs source' })).toBeTruthy();

      await userEvent.type(
        screen.getByRole('textbox', { name: 'Filter tag' }),
        'Link Toh 123{Enter}',
      );

      expect(mockGetTaggedComments).toHaveBeenLastCalledWith(
        expect.objectContaining({ tag: 'link toh 123', workUuid: 'w1' }),
      );
      await userEvent.click(
        await screen.findByRole('button', {
          name: 'Clear link toh 123 filter',
        }),
      );
      expect(await screen.findByText('body of t1')).toBeTruthy();
    });

    it('reads no tagged comments until a filter is chosen', async () => {
      render(<CommentsPanel workUuid="w1" />);
      await screen.findByRole('button', { name: 'Filter by tag' });

      expect(mockGetTaggedComments).not.toHaveBeenCalled();
    });
  });
});
