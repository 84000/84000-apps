import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GlossaryTermInstanceRow } from '@eightyfourthousand/client-graphql';

import {
  EditorContext,
  type EditorContextState,
} from '../../editor/editor-context';
import { GlossaryInstancesTable } from './GlossaryInstancesTable';

const mockUpdatePanel = jest.fn();
const mockGetGlossaryTermInstances = jest.fn();
const mockNavigation = { toh: 'toh8', updatePanel: mockUpdatePanel };
const mockRemove = jest.fn();
let mockDirty = false;
const mockEditor = {
  readOnly: true,
  work: { uuid: 'work-1' },
  dirtyStore: { getSnapshot: () => mockDirty },
  save: jest.fn(async () => undefined),
  applyReplacedPassages: jest.fn(async () => undefined),
};

jest.mock('../NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  createGraphQLClient: () => ({}),
  getGlossaryTermInstances: (...args: unknown[]) =>
    mockGetGlossaryTermInstances(...args),
  removeGlossaryTermInstances: (...args: unknown[]) => mockRemove(...args),
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
  render(
    <EditorContext.Provider value={mockEditor as unknown as EditorContextState}>
      <GlossaryInstancesTable termUuid="term-1" onClose={onClose} />
    </EditorContext.Provider>,
  );

beforeEach(() => {
  mockUpdatePanel.mockReset();
  mockGetGlossaryTermInstances.mockReset();
  onClose.mockReset();
  mockRemove.mockReset();
  mockEditor.readOnly = true;
  mockEditor.save.mockClear();
  mockEditor.applyReplacedPassages.mockClear();
  mockDirty = false;
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

  describe('deleting', () => {
    beforeEach(() => {
      mockEditor.readOnly = false;
    });

    const removed = (uuids: string[], extra = {}) => ({
      removed: uuids,
      failed: [],
      passages: uuids.map((uuid) => ({ uuid: `p-${uuid}`, json: null })),
      ...extra,
    });

    it('offers no delete or select controls to a reader', async () => {
      mockEditor.readOnly = true;
      mockGetGlossaryTermInstances.mockResolvedValue(page([row(1)], 1));

      renderTable();
      await screen.findByRole('button', { name: '1.1' });

      expect(screen.queryByRole('checkbox')).toBeNull();
      expect(screen.queryByRole('button', { name: /Delete/ })).toBeNull();
    });

    it('deletes one instance after a confirmation', async () => {
      mockGetGlossaryTermInstances
        .mockResolvedValueOnce(page([row(1), row(2)], 2))
        .mockResolvedValueOnce(page([row(2)], 1));
      mockRemove.mockResolvedValue(removed(['a-1']));

      renderTable();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Delete instance in 1.1' }),
      );
      const confirm = screen.getByRole('alertdialog');
      expect(confirm.textContent).toContain('Delete the instance in 1.1?');
      expect(mockRemove).not.toHaveBeenCalled();

      await userEvent.click(
        within(confirm).getByRole('button', { name: 'Delete' }),
      );

      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({
          workUuid: 'work-1',
          termUuid: 'term-1',
          annotationUuids: ['a-1'],
        }),
      );
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: '1.1' })).toBeNull(),
      );
      expect(mockEditor.applyReplacedPassages).toHaveBeenCalledWith([
        { uuid: 'p-a-1', json: null },
      ]);
      expect(screen.getByText('1 instance')).toBeTruthy();
    });

    it('cancels without deleting', async () => {
      mockGetGlossaryTermInstances.mockResolvedValue(page([row(1)], 1));

      renderTable();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Delete instance in 1.1' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('deletes the selected instances, select-all covering the page', async () => {
      mockGetGlossaryTermInstances
        .mockResolvedValueOnce(page([row(1), row(2), row(3)], 3))
        .mockResolvedValueOnce(page([], 0));
      mockRemove.mockResolvedValue(removed(['a-1', 'a-2', 'a-3']));

      renderTable();
      await screen.findByRole('button', { name: '1.1' });
      const deleteSelected = () =>
        screen.getByRole('button', { name: /Delete selected/ });
      expect(deleteSelected().hasAttribute('disabled')).toBe(true);

      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Select instance in 1.2' }),
      );
      expect(deleteSelected().textContent).toBe('Delete selected (1)');

      await userEvent.click(
        screen.getByRole('checkbox', { name: 'Select all on this page' }),
      );
      expect(deleteSelected().textContent).toBe('Delete selected (3)');

      await userEvent.click(deleteSelected());
      const confirm = screen.getByRole('alertdialog');
      expect(confirm.textContent).toContain('Delete 3 instances?');
      await userEvent.click(
        within(confirm).getByRole('button', { name: 'Delete' }),
      );

      expect(mockRemove).toHaveBeenCalledWith(
        expect.objectContaining({ annotationUuids: ['a-1', 'a-2', 'a-3'] }),
      );
      await waitFor(() =>
        expect(screen.getByText(/isn.t linked in any passage/)).toBeTruthy(),
      );
    });

    it('names the passages that failed and keeps their rows', async () => {
      mockGetGlossaryTermInstances
        .mockResolvedValueOnce(page([row(1), row(2)], 2))
        .mockResolvedValueOnce(page([row(2)], 1));
      mockRemove.mockResolvedValue(
        removed(['a-1'], {
          failed: [
            {
              passageUuid: 'p-2',
              passageLabel: '1.2',
              annotationUuids: ['a-2'],
              error: 'deadlock detected',
            },
          ],
        }),
      );

      renderTable();
      await userEvent.click(
        await screen.findByRole('checkbox', {
          name: 'Select all on this page',
        }),
      );
      await userEvent.click(
        screen.getByRole('button', { name: /Delete selected/ }),
      );
      await userEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', {
          name: 'Delete',
        }),
      );

      expect(
        await screen.findByText(/Instances in 1\.2 couldn.t be deleted/),
      ).toBeTruthy();
      await waitFor(() =>
        expect(screen.queryByRole('button', { name: '1.1' })).toBeNull(),
      );
      expect(screen.getByRole('button', { name: '1.2' })).toBeTruthy();
      expect(screen.getByText(/Not deleted: deadlock detected/)).toBeTruthy();
    });

    it('saves pending changes first, and stops if they stay unsaved', async () => {
      mockDirty = true;
      mockGetGlossaryTermInstances.mockResolvedValue(page([row(1)], 1));

      renderTable();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Delete instance in 1.1' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      expect(mockEditor.save).toHaveBeenCalled();
      expect(await screen.findByText(/nothing was deleted/)).toBeTruthy();
      expect(mockRemove).not.toHaveBeenCalled();
    });

    it('moves back a page when the last one empties', async () => {
      mockGetGlossaryTermInstances
        .mockResolvedValueOnce(page([row(1)], 51))
        .mockResolvedValueOnce(page([row(51)], 51, 50))
        .mockResolvedValueOnce(page([row(1)], 50, 0));
      mockRemove.mockResolvedValue(removed(['a-51']));

      renderTable();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Last' }),
      );
      await userEvent.click(
        await screen.findByRole('button', { name: 'Delete instance in 1.51' }),
      );
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

      await waitFor(() =>
        expect(mockGetGlossaryTermInstances).toHaveBeenLastCalledWith(
          expect.objectContaining({ offset: 0 }),
        ),
      );
    });
  });
});
