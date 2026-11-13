import { act, fireEvent, render, screen } from '@testing-library/react';
import type { GlossaryEntry } from '@eightyfourthousand/data-access';

import { GlossaryRowMenu } from './GlossaryRowMenu';
import type { StackController } from './StackController';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockGetComments = jest.fn();
const mockCreateComment = jest.fn();
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getGlossaryComments: (args: unknown) => mockGetComments(args),
  createComment: (args: unknown) => mockCreateComment(args),
}));

const mockToast = jest.fn();
jest.mock('@eightyfourthousand/design-system', () => ({
  ...jest.requireActual('@eightyfourthousand/design-system'),
  toast: (...args: unknown[]) => mockToast(...args),
}));

const mockRefreshComments = jest.fn();
const mockSetFocusedComment = jest.fn();
const mockUpdatePanel = jest.fn();
const mockNavigation = { editable: true, commentsRevision: 0 };
jest.mock('../shared/NavigationContext', () => ({
  useNavigation: () => ({
    ...mockNavigation,
    refreshComments: mockRefreshComments,
    setFocusedComment: mockSetFocusedComment,
    updatePanel: mockUpdatePanel,
  }),
}));

jest.mock('./stack-work-context', () => ({
  useStackWork: () => ({ work: { workUuid: 'w1' } }),
}));

const ENTRY = {
  uuid: 'e1',
  names: [
    {
      nameUuid: 'n1',
      language: 'en',
      content: 'Indra',
      termType: 'translationMain',
    },
  ],
} as GlossaryEntry;

/** What `getGlossaryComments` answers: one entry with threads, or none. */
const entriesWith = (...threads: string[]) =>
  threads.length
    ? [
        {
          passageUuid: 'e1',
          label: 'Indra',
          type: 'glossary',
          sort: 0,
          anchored: threads.map((uuid) => ({ thread: { uuid }, anchors: [] })),
          unanchored: [],
        },
      ]
    : [];

const open = async (threads: string[] = []) => {
  mockGetComments.mockResolvedValue(entriesWith(...threads));
  const controller = {
    getMeta: (uuid: string) => ({ uuid, label: 'g.4', type: 'glossary' }),
    getGlossaryEntry: () => ENTRY,
  } as unknown as StackController;
  const onClose = jest.fn();
  const target = { uuid: 'e1', rect: { top: 0, left: 0, width: 1, height: 1 } };
  const menu = () => (
    <GlossaryRowMenu
      controller={controller}
      target={target}
      onClose={onClose}
    />
  );
  let view!: ReturnType<typeof render>;
  await act(async () => {
    view = render(menu());
  });
  return {
    onClose,
    /** Draws the menu again, as a changed revision would. */
    redraw: () =>
      act(async () => {
        view.rerender(menu());
      }),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation.editable = true;
  mockNavigation.commentsRevision = 0;
});

describe('GlossaryRowMenu comment entry', () => {
  it('reads which entries have threads once for the work, not per open', async () => {
    await open(['t1']);

    expect(mockGetComments).toHaveBeenCalledTimes(1);
    expect(mockGetComments).toHaveBeenCalledWith(
      expect.objectContaining({ workUuid: 'w1' }),
    );
  });

  it('reads again when a comment is written, so the label follows', async () => {
    const { redraw } = await open();
    expect(screen.getByText('Add comment')).toBeTruthy();

    mockGetComments.mockResolvedValue(entriesWith('t1'));
    mockNavigation.commentsRevision = 1;
    await redraw();

    expect(mockGetComments).toHaveBeenCalledTimes(2);
    expect(screen.getByText('See comments')).toBeTruthy();
    expect(screen.queryByText('Add comment')).toBeNull();
  });

  it('says "Add comment" for an entry with no thread, and asks for the first', async () => {
    const { onClose } = await open();
    expect(screen.queryByText('See comments')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('Add comment'));
    });

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('Comment on g.4 Indra')).toBeTruthy();
  });

  it('says "See comments" for an entry with a thread, and opens it in the panel', async () => {
    const { onClose } = await open(['t1', 't2']);
    expect(screen.queryByText('Add comment')).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByText('See comments'));
    });

    expect(onClose).toHaveBeenCalled();
    expect(mockSetFocusedComment).toHaveBeenCalledWith('t1');
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'left',
      state: { open: true, tab: 'comments', hash: 't1' },
    });
    expect(screen.queryByText('Comment on g.4 Indra')).toBeNull();
  });

  it('is not offered where the work is read-only', async () => {
    mockNavigation.editable = false;
    await open(['t1']);

    expect(screen.getByText('Copy Link')).toBeTruthy();
    expect(screen.queryByText('See comments')).toBeNull();
    expect(screen.queryByText('Add comment')).toBeNull();
    expect(mockGetComments).not.toHaveBeenCalled();
  });

  const write = async () => {
    await open();
    await act(async () => {
      fireEvent.click(screen.getByText('Add comment'));
    });
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Is this the right term?' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
    });
  };

  it('starts a thread on the entry and shows it in the comments panel', async () => {
    mockCreateComment.mockResolvedValue({
      success: true,
      comment: { uuid: 'c1' },
    });

    await write();

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        entityUuid: 'e1',
        entityType: 'glossary',
        content: '<p>Is this the right term?</p>',
      }),
    );
    expect(mockRefreshComments).toHaveBeenCalled();
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'left',
      state: { open: true, tab: 'comments', hash: 'c1' },
    });
    expect(screen.queryByText('Comment on g.4 Indra')).toBeNull();
  });

  it('keeps the draft and says so when the thread is not saved', async () => {
    mockCreateComment.mockResolvedValue({ success: false, error: 'Nope' });

    await write();

    expect(mockToast).toHaveBeenCalledWith('Nope', expect.anything());
    expect(mockUpdatePanel).not.toHaveBeenCalled();
    expect(mockRefreshComments).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
