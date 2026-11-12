import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GlossaryExcerptsPage } from '@eightyfourthousand/client-graphql';

import {
  GlossaryPassagesProvider,
  useGlossaryPassages,
} from './GlossaryPassagesDialog';
import { GlossaryPassagesLink } from './GlossaryPassagesLink';

const mockUpdatePanel = jest.fn();
const mockFetchGlossaryTerm = jest.fn();
const mockGetGlossaryTermExcerpts = jest.fn();
const mockNavigation = {
  toh: 'toh8',
  updatePanel: mockUpdatePanel,
  fetchGlossaryTerm: mockFetchGlossaryTerm,
};

jest.mock('../NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getGlossaryTermExcerpts: (...args: unknown[]) =>
    mockGetGlossaryTermExcerpts(...args),
}));
jest.mock('./GlossaryInstancesTable', () => ({
  GlossaryInstancesTable: ({
    termUuid,
    onRemoved,
  }: {
    termUuid: string;
    onRemoved?: () => void;
  }) => (
    <>
      <p>instances of {termUuid}</p>
      <button onClick={onRemoved}>removed</button>
    </>
  ),
}));

const item = (n: number, overrides = {}) => ({
  uuid: `p-${n}`,
  label: `1.${n}`,
  type: 'translation',
  sort: n,
  toh: null,
  instanceCount: 1,
  text: `Passage ${n} names the term here.`,
  truncatedStart: false,
  truncatedEnd: false,
  highlights: [{ start: 20, end: 24 }],
  ...overrides,
});

const page = (
  items: ReturnType<typeof item>[],
  totalCount: number,
  offset = 0,
): GlossaryExcerptsPage => {
  const hasMore = offset + items.length < totalCount;
  return {
    items,
    totalCount,
    hasMore,
    nextCursor: hasMore ? String(offset + items.length) : null,
  };
};

const Opener = () => {
  const passages = useGlossaryPassages();
  return (
    <button
      onClick={() =>
        passages?.openGlossaryPassages({ uuid: 'term-1', english: 'virtue' })
      }
    >
      open
    </button>
  );
};

const openDialog = async ({ instances = false } = {}) => {
  render(
    <GlossaryPassagesProvider instances={instances}>
      <Opener />
    </GlossaryPassagesProvider>,
  );
  await userEvent.click(screen.getByText('open'));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  mockUpdatePanel.mockReset();
  mockFetchGlossaryTerm.mockReset();
  mockGetGlossaryTermExcerpts.mockReset();
});

describe('GlossaryPassagesDialog', () => {
  it('reads nothing until it is opened', () => {
    render(
      <GlossaryPassagesProvider>
        <Opener />
      </GlossaryPassagesProvider>,
    );

    expect(mockGetGlossaryTermExcerpts).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('titles the dialog with the entry and its passage count', async () => {
    mockGetGlossaryTermExcerpts.mockResolvedValue(page([item(1)], 1234));

    const dialog = await openDialog();

    await within(dialog).findByText(/1,234 passages/);
    expect(within(dialog).getByRole('heading').textContent).toContain('virtue');
    expect(mockGetGlossaryTermExcerpts).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'term-1',
        toh: 'toh8',
        first: 20,
        after: null,
      }),
    );
  });

  it('shows each excerpt with its label, highlights and use count', async () => {
    mockGetGlossaryTermExcerpts.mockResolvedValue(
      page(
        [
          item(1, {
            instanceCount: 3,
            truncatedStart: true,
            truncatedEnd: true,
          }),
          item(2),
        ],
        2,
      ),
    );

    const dialog = await openDialog();

    const first = await within(dialog).findByText('1.1');
    const button = first.closest('button') as HTMLElement;
    expect(within(button).getByText('3 uses')).toBeTruthy();
    expect(button.textContent).toContain('…Passage 1 names the term here.…');
    expect(button.querySelector('mark')?.textContent).toBe('term');

    const second = (await within(dialog).findByText('1.2')).closest(
      'button',
    ) as HTMLElement;
    expect(second.textContent).not.toContain('use');
    expect(second.textContent).not.toContain('…');
  });

  it('loads the next 20 on request until the last passage', async () => {
    const first = Array.from({ length: 20 }, (_, i) => item(i + 1));
    mockGetGlossaryTermExcerpts
      .mockResolvedValueOnce(page(first, 23))
      .mockResolvedValueOnce(page([item(21), item(22), item(23)], 23, 20));

    const dialog = await openDialog();

    await userEvent.click(
      await within(dialog).findByRole('button', { name: /next 3/ }),
    );

    await within(dialog).findByText('1.23');
    expect(mockGetGlossaryTermExcerpts).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: '20' }),
    );
    expect(within(dialog).getByText('1.1')).toBeTruthy();
    expect(within(dialog).queryByRole('button', { name: /next/ })).toBeNull();
  });

  it('closes and jumps to the passage clicked', async () => {
    mockGetGlossaryTermExcerpts.mockResolvedValue(
      page([item(1, { type: 'summary' })], 1),
    );

    const dialog = await openDialog();
    await userEvent.click(await within(dialog).findByText('1.1'));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'main',
      state: { open: true, tab: 'front', hash: 'p-1' },
    });
  });

  it('says so when the entry is not linked in any passage', async () => {
    mockGetGlossaryTermExcerpts.mockResolvedValue(page([], 0));

    const dialog = await openDialog();

    expect(
      await within(dialog).findByText(/isn.t linked in any passage/),
    ).toBeTruthy();
  });

  it('tells a failed read from an empty one', async () => {
    mockGetGlossaryTermExcerpts.mockResolvedValue(null);

    const dialog = await openDialog();

    expect(await within(dialog).findByText(/couldn.t be loaded/)).toBeTruthy();
    expect(within(dialog).queryByText(/isn.t linked/)).toBeNull();
  });
});

describe('the Instances tab', () => {
  it('is not in the reader', async () => {
    mockGetGlossaryTermExcerpts.mockResolvedValue(page([item(1)], 1));

    const dialog = await openDialog();

    await within(dialog).findByText('1.1');
    expect(within(dialog).queryByRole('tab')).toBeNull();
  });

  it('is in the editor, beside the passages, and lists on request', async () => {
    mockGetGlossaryTermExcerpts.mockResolvedValue(page([item(1)], 1));

    const dialog = await openDialog({ instances: true });

    const passagesTab = within(dialog).getByRole('tab', { name: 'Passages' });
    expect(passagesTab.getAttribute('aria-selected')).toBe('true');
    await within(dialog).findByText('1.1');
    expect(within(dialog).queryByText(/instances of/)).toBeNull();

    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Instances' }),
    );

    expect(within(dialog).getByText('instances of term-1')).toBeTruthy();
    expect(within(dialog).queryByText('1.1')).toBeNull();
  });

  it('reads the passages again after instances are removed', async () => {
    mockGetGlossaryTermExcerpts
      .mockResolvedValueOnce(page([item(1), item(2)], 2))
      .mockResolvedValueOnce(page([item(2)], 1));

    const dialog = await openDialog({ instances: true });
    await within(dialog).findByText('1.1');
    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Instances' }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'removed' }),
    );
    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Passages' }),
    );

    await within(dialog).findByText('1.2');
    expect(within(dialog).queryByText('1.1')).toBeNull();
    expect(mockGetGlossaryTermExcerpts).toHaveBeenCalledTimes(2);
  });

  it('retries the first page when the read after a removal fails', async () => {
    mockGetGlossaryTermExcerpts
      .mockResolvedValueOnce(page([item(1)], 60))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(page([item(2)], 59));

    const dialog = await openDialog({ instances: true });
    await within(dialog).findByText('1.1');
    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Instances' }),
    );
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'removed' }),
    );
    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Passages' }),
    );

    await within(dialog).findByText(/The passages couldn.t be loaded/);
    expect(within(dialog).queryByText('1.1')).toBeNull();
    await userEvent.click(
      within(dialog).getByRole('button', { name: 'Try again' }),
    );

    await within(dialog).findByText('1.2');
    expect(mockGetGlossaryTermExcerpts).toHaveBeenLastCalledWith(
      expect.objectContaining({ after: null }),
    );
  });
});

describe('GlossaryPassagesLink', () => {
  it('opens the dialog for its entry without another read', async () => {
    mockGetGlossaryTermExcerpts.mockResolvedValue(page([item(1)], 1));

    render(
      <GlossaryPassagesProvider>
        <GlossaryPassagesLink uuid="term-1" english="virtue" />
      </GlossaryPassagesProvider>,
    );
    expect(mockGetGlossaryTermExcerpts).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole('button', { name: 'Passages ›' }));

    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByText(/1 passage$/);
    expect(within(dialog).getByRole('heading').textContent).toContain('virtue');
    expect(mockFetchGlossaryTerm).not.toHaveBeenCalled();
    expect(mockGetGlossaryTermExcerpts).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'term-1' }),
    );
  });

  it('draws nothing outside a provider', () => {
    render(<GlossaryPassagesLink uuid="g" english="virtue" />);

    expect(screen.queryByRole('button')).toBeNull();
  });
});
