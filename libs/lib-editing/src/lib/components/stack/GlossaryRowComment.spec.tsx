import { act, fireEvent, render, screen } from '@testing-library/react';

import { GlossaryRowComment } from './GlossaryRowComment';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockCreateComment = jest.fn();
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
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
const mockNavigation = { editable: true };
jest.mock('../shared/NavigationContext', () => ({
  useNavigation: () => ({
    editable: mockNavigation.editable,
    refreshComments: mockRefreshComments,
    setFocusedComment: mockSetFocusedComment,
    updatePanel: mockUpdatePanel,
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockNavigation.editable = true;
});

const write = async (text: string) => {
  fireEvent.click(screen.getByRole('button', { name: 'Comment' }));
  fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
  await act(async () => {
    fireEvent.click(screen.getAllByRole('button', { name: 'Comment' })[1]);
  });
};

describe('GlossaryRowComment', () => {
  it('draws nothing where the work is read-only', () => {
    mockNavigation.editable = false;

    const { container } = render(<GlossaryRowComment uuid="g1" />);

    expect(container.textContent).toBe('');
  });

  it('starts a thread on the entry and shows it in the comments panel', async () => {
    mockCreateComment.mockResolvedValue({
      success: true,
      comment: { uuid: 'c1' },
    });
    render(<GlossaryRowComment uuid="g1" />);

    await write('Is this the right term?');

    expect(mockCreateComment).toHaveBeenCalledWith(
      expect.objectContaining({
        entityUuid: 'g1',
        entityType: 'glossary',
        content: '<p>Is this the right term?</p>',
      }),
    );
    expect(mockRefreshComments).toHaveBeenCalled();
    expect(mockSetFocusedComment).toHaveBeenCalledWith('c1');
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'left',
      state: { open: true, tab: 'comments', hash: 'c1' },
    });
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('keeps the draft and says so when the thread is not saved', async () => {
    mockCreateComment.mockResolvedValue({ success: false, error: 'Nope' });
    render(<GlossaryRowComment uuid="g1" />);

    await write('Is this the right term?');

    expect(mockToast).toHaveBeenCalledWith('Nope', expect.anything());
    expect(mockUpdatePanel).not.toHaveBeenCalled();
    expect(mockRefreshComments).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toBeTruthy();
  });
});
