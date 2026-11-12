import { act, fireEvent, render, screen } from '@testing-library/react';
import type {
  GlossaryEntry,
  GlossaryExcerptsPage,
} from '@eightyfourthousand/data-access';

import { GlossaryRowMenu } from './GlossaryRowMenu';
import type { StackController } from './StackController';

// See PassageStackController.spec.ts — the stack's barrels reach
// `data-access/ssr`, which leaks these.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const mockExcerpts = jest.fn();
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: () => ({}),
  getGlossaryTermExcerpts: (args: unknown) => mockExcerpts(args),
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

const excerpt = (uuid: string, label: string, instanceCount: number) => ({
  uuid,
  label,
  type: 'translation',
  sort: 1,
  toh: null,
  instanceCount,
  excerpt: {
    text: `${label} mentions Indra here`,
    truncatedStart: false,
    truncatedEnd: true,
    highlights: [],
  },
});

const PAGE: GlossaryExcerptsPage = {
  items: [excerpt('p1', '1.2', 1), excerpt('p2', '1.7', 3)],
  totalCount: 2,
  nextCursor: null,
  hasMore: false,
};

const setup = () => {
  const remove = jest.fn().mockResolvedValue({ deleted: true });
  const controller = {
    getMeta: (uuid: string) => ({ uuid, label: 'g.4', type: 'glossary' }),
    getGlossaryEntry: () => ENTRY,
    deleteGlossaryEntry: remove,
  } as unknown as StackController;
  const target = { uuid: 'e1', rect: { top: 0, left: 0, width: 1, height: 1 } };
  const onClose = jest.fn();
  const view = render(
    <GlossaryRowMenu
      controller={controller}
      target={target}
      onClose={onClose}
    />,
  );
  // Opening the dialog closes the menu, which the stack does by clearing it.
  const openDialog = async () => {
    await act(async () => {
      fireEvent.click(screen.getByText('Delete'));
    });
    view.rerender(
      <GlossaryRowMenu
        controller={controller}
        target={null}
        onClose={onClose}
      />,
    );
    await act(async () => undefined);
  };
  return { remove, openDialog };
};

beforeEach(() => {
  mockExcerpts.mockReset();
});

describe('GlossaryRowMenu', () => {
  it('offers delete, which asks first and lists the passages with instances', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    await openDialog();

    expect(screen.getByText('Delete g.4 Indra')).toBeTruthy();
    expect(mockExcerpts).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'e1', source: 'draft' }),
    );
    expect(screen.getByText(/instances in 2 passages/)).toBeTruthy();
    expect(screen.getByText('1.2')).toBeTruthy();
    expect(screen.getByText('1 instance')).toBeTruthy();
    expect(screen.getByText('1.7')).toBeTruthy();
    expect(screen.getByText('3 instances')).toBeTruthy();
    expect(remove).not.toHaveBeenCalled();
  });

  it('counts the passages past the ones listed', async () => {
    mockExcerpts.mockResolvedValue({ ...PAGE, totalCount: 60, hasMore: true });
    const { openDialog } = setup();
    await openDialog();
    expect(screen.getByText(/instances in 60 passages/)).toBeTruthy();
    expect(screen.getByText('and 58 more passages.')).toBeTruthy();
  });

  it('says so when no passage has an instance', async () => {
    mockExcerpts.mockResolvedValue({ ...PAGE, items: [], totalCount: 0 });
    const { openDialog } = setup();
    await openDialog();
    expect(screen.getByText('No passage has an instance of it.')).toBeTruthy();
  });

  it('cancelling changes nothing', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByText('Cancel'));
    });
    expect(remove).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete g.4 Indra')).toBeNull();
  });

  it('confirming deletes the entry and closes', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    expect(remove).toHaveBeenCalledWith(
      'e1',
      expect.objectContaining({ passages: [] }),
    );
    expect(screen.queryByText('Delete g.4 Indra')).toBeNull();
  });

  it('keeps the dialog open with the reason when the delete is refused', async () => {
    mockExcerpts.mockResolvedValue(PAGE);
    const { remove, openDialog } = setup();
    remove.mockResolvedValue({ deleted: false, error: 'Not allowed' });
    await openDialog();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    });
    expect(screen.getByRole('alert').textContent).toContain('Not allowed');
    expect(screen.getByText('Delete g.4 Indra')).toBeTruthy();
  });
});
