import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GlossaryTermInstanceRow } from '@eightyfourthousand/client-graphql';

import { GlossaryInstancesTable } from './GlossaryInstancesTable';

const mockUpdatePanel = jest.fn();
const mockGetGlossaryTermInstances = jest.fn();
const mockNavigation = { toh: 'toh8', updatePanel: mockUpdatePanel };

jest.mock('../NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getGlossaryTermInstances: (...args: unknown[]) =>
    mockGetGlossaryTermInstances(...args),
}));

const row = (
  n: number,
  overrides: Partial<GlossaryTermInstanceRow> = {},
): GlossaryTermInstanceRow => ({
  uuid: `a-${n}`,
  passageUuid: `p-${n}`,
  passageLabel: `1.${n}`,
  passageType: 'translation',
  passageSort: n,
  start: 10 + n,
  end: 14 + n,
  before: 'words before ',
  text: 'term',
  after: ' words after',
  truncatedStart: true,
  truncatedEnd: false,
  outOfRange: false,
  ...overrides,
});

const page = (
  items: GlossaryTermInstanceRow[],
  totalCount: number,
  offset = 0,
) => ({
  items,
  totalCount,
  offset,
});

const onClose = jest.fn();

const renderTable = () =>
  render(<GlossaryInstancesTable termUuid="term-1" onClose={onClose} />);

beforeEach(() => {
  mockUpdatePanel.mockReset();
  mockGetGlossaryTermInstances.mockReset();
  onClose.mockReset();
  window.history.replaceState(null, '', '/?toh=toh8');
});

describe('GlossaryInstancesTable', () => {
  it('shows each instance with its passage, text in context and offsets', async () => {
    mockGetGlossaryTermInstances.mockResolvedValue(page([row(1), row(2)], 2));

    renderTable();

    await screen.findByRole('button', { name: '1.1' });
    const table = screen.getByRole('table', { name: 'Instances' });
    const cells = within(within(table).getAllByRole('row')[1]).getAllByRole(
      'cell',
    );
    expect(cells[0].textContent).toBe('1.1');
    expect(cells[1].textContent).toBe('…words before term words after');
    expect(cells[1].querySelector('mark')?.textContent).toBe('term');
    expect(cells[2].textContent).toBe('11–15');
    expect(screen.getByText('2 instances')).toBeTruthy();
    expect(mockGetGlossaryTermInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'term-1',
        toh: 'toh8',
        first: 50,
        offset: 0,
      }),
    );
  });

  it('warns on a row whose offsets fall outside the text', async () => {
    mockGetGlossaryTermInstances.mockResolvedValue(
      page([row(1, { outOfRange: true, text: '' })], 1),
    );

    renderTable();

    expect(await screen.findByText(/outside the passage text/)).toBeTruthy();
    expect(screen.getByText('1 instance')).toBeTruthy();
  });

  it('shows one page for fewer instances than a page, and a passage without a label by its uuid', async () => {
    mockGetGlossaryTermInstances.mockResolvedValue(
      page(
        [
          row(1, { passageLabel: null, passageUuid: 'abcdef123456' }),
          ...[2, 3, 4, 5, 6, 7].map((n) => row(n)),
        ],
        7,
      ),
    );

    renderTable();

    expect(await screen.findByRole('button', { name: 'abcdef' })).toBeTruthy();
    expect(screen.getByText('Page 1 of 1')).toBeTruthy();
    expect(screen.getByText('7 instances')).toBeTruthy();
    for (const name of ['First', 'Previous', 'Next', 'Last']) {
      expect(
        screen.getByRole('button', { name }).hasAttribute('disabled'),
      ).toBe(true);
    }
  });

  it('pages 50 at a time, straight to the last page', async () => {
    mockGetGlossaryTermInstances
      .mockResolvedValueOnce(page([row(1)], 18697))
      .mockResolvedValueOnce(page([row(9)], 18697, 18650))
      .mockResolvedValueOnce(page([row(8)], 18697, 18600));

    renderTable();

    expect(await screen.findByText('Page 1 of 374')).toBeTruthy();
    expect(screen.getByText('18,697 instances')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Previous' }).hasAttribute('disabled'),
    ).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Last' }));
    expect(await screen.findByText('1.9')).toBeTruthy();
    expect(screen.getByText('Page 374 of 374')).toBeTruthy();
    expect(mockGetGlossaryTermInstances).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 18650 }),
    );
    expect(
      screen.getByRole('button', { name: 'Next' }).hasAttribute('disabled'),
    ).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('1.8')).toBeTruthy();
    expect(mockGetGlossaryTermInstances).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 18600 }),
    );
  });

  it('closes and jumps to the passage, highlighting the instance', async () => {
    mockGetGlossaryTermInstances.mockResolvedValue(
      page([row(1, { passageType: 'summary', start: 5, end: 9 })], 1),
    );

    renderTable();
    await userEvent.click(await screen.findByRole('button', { name: '1.1' }));

    expect(onClose).toHaveBeenCalled();
    const query = new URLSearchParams(window.location.search);
    expect(query.get('start')).toBe('5');
    expect(query.get('end')).toBe('9');
    expect(query.get('toh')).toBe('toh8');
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'main',
      state: { open: true, tab: 'front', hash: 'p-1' },
    });
  });

  it('jumps without a highlight when the offsets are out of range', async () => {
    window.history.replaceState(null, '', '/?start=1&end=2');
    mockGetGlossaryTermInstances.mockResolvedValue(
      page([row(1, { outOfRange: true })], 1),
    );

    renderTable();
    await userEvent.click(await screen.findByRole('button', { name: '1.1' }));

    const query = new URLSearchParams(window.location.search);
    expect(query.has('start')).toBe(false);
    expect(query.has('end')).toBe(false);
  });

  it('retries the page that failed, not the one still shown', async () => {
    mockGetGlossaryTermInstances
      .mockResolvedValueOnce(page([row(1)], 120))
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(page([row(51)], 120, 50));

    renderTable();
    await userEvent.click(await screen.findByRole('button', { name: 'Next' }));
    await userEvent.click(
      await screen.findByRole('button', { name: 'Try again' }),
    );

    expect(await screen.findByText('1.51')).toBeTruthy();
    expect(mockGetGlossaryTermInstances).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: 50 }),
    );
  });

  it('tells a failed read from an empty one, and retries', async () => {
    mockGetGlossaryTermInstances
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(page([], 0));

    renderTable();

    expect(await screen.findByText(/couldn.t be loaded/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(screen.getByText(/isn.t linked in any passage/)).toBeTruthy(),
    );
  });
});
