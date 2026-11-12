import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  GlossaryPassagesProvider,
  useGlossaryPassages,
} from './GlossaryPassagesDialog';

// Acceptance tests for DEV-912 criterion 1: the editor's passages dialog has
// a second tab, "Instances"; the reader's does not.

const mockGetExcerpts = jest.fn();
const mockGetInstances = jest.fn();
const mockNavigation = { toh: 'toh8', updatePanel: jest.fn() };

jest.mock('../NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  getGlossaryTermExcerpts: (...args: unknown[]) => mockGetExcerpts(...args),
  getGlossaryTermInstances: (...args: unknown[]) => mockGetInstances(...args),
}));

const excerpt = {
  uuid: 'p-1',
  label: '1.1',
  type: 'translation',
  sort: 1,
  toh: null,
  instanceCount: 1,
  text: 'Passage one names the term here.',
  truncatedStart: false,
  truncatedEnd: false,
  highlights: [{ start: 20, end: 24 }],
};

const instanceRow = (i: number) => ({
  uuid: `a-${i}`,
  passageUuid: `p-${i}`,
  passageLabel: `2.${i + 1}`,
  passageType: 'translation',
  passageSort: i + 1,
  start: 10 + i,
  end: 20 + i,
  before: 'before words',
  text: 'the term',
  after: 'after words',
  truncatedStart: false,
  truncatedEnd: false,
  outOfRange: false,
});

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

const openDialog = async (instances?: boolean) => {
  render(
    <GlossaryPassagesProvider {...(instances ? { instances } : {})}>
      <Opener />
    </GlossaryPassagesProvider>,
  );
  await userEvent.click(screen.getByText('open'));
  return screen.findByRole('dialog');
};

beforeEach(() => {
  mockGetExcerpts.mockReset();
  mockGetInstances.mockReset();
  mockGetExcerpts.mockResolvedValue({
    items: [excerpt],
    totalCount: 1,
    hasMore: false,
    nextCursor: null,
  });
  mockGetInstances.mockResolvedValue({
    items: [instanceRow(0), instanceRow(1), instanceRow(2)],
    totalCount: 3,
    offset: 0,
  });
});

describe('DEV-912 criterion 1: Instances tab in the editor only', () => {
  it('criterion 1: with instances on, the dialog has Passages and Instances tabs', async () => {
    const dialog = await openDialog(true);

    expect(within(dialog).getByRole('tab', { name: 'Passages' })).toBeTruthy();
    expect(within(dialog).getByRole('tab', { name: 'Instances' })).toBeTruthy();
  });

  it('criterion 1: Passages is the tab the dialog opens on, and still lists the passages', async () => {
    const dialog = await openDialog(true);

    const passages = within(dialog).getByRole('tab', { name: 'Passages' });
    expect(passages.getAttribute('aria-selected')).toBe('true');
    expect(await within(dialog).findByText(/Passage one names/)).toBeTruthy();
    expect(
      within(dialog).queryByRole('table', { name: 'Instances' }),
    ).toBeNull();
  });

  it('criterion 1: opening the Instances tab shows the instances table', async () => {
    const dialog = await openDialog(true);

    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Instances' }),
    );

    expect(
      await within(dialog).findByRole('table', { name: 'Instances' }),
    ).toBeTruthy();
    expect(
      within(dialog)
        .getByRole('tab', { name: 'Instances' })
        .getAttribute('aria-selected'),
    ).toBe('true');
    expect(mockGetInstances).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'term-1', toh: 'toh8' }),
    );
  });

  it('criterion 3: the Instances tab shows the total instance count', async () => {
    const dialog = await openDialog(true);

    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Instances' }),
    );

    expect(await within(dialog).findByText(/3 instances/)).toBeTruthy();
  });

  it('criterion 1: the dialog can go back to the Passages tab', async () => {
    const dialog = await openDialog(true);
    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Instances' }),
    );
    await within(dialog).findByRole('table', { name: 'Instances' });

    await userEvent.click(
      within(dialog).getByRole('tab', { name: 'Passages' }),
    );

    expect(await within(dialog).findByText(/Passage one names/)).toBeTruthy();
    expect(
      within(dialog).queryByRole('table', { name: 'Instances' }),
    ).toBeNull();
  });

  it("criterion 1: without instances, the reader's dialog has no Instances tab", async () => {
    const dialog = await openDialog();

    expect(await within(dialog).findByText(/Passage one names/)).toBeTruthy();
    expect(within(dialog).queryByRole('tab', { name: 'Instances' })).toBeNull();
    expect(
      within(dialog).queryByRole('table', { name: 'Instances' }),
    ).toBeNull();
  });

  it("criterion 1: without instances, the reader's dialog never reads instances", async () => {
    const dialog = await openDialog();
    await within(dialog).findByText(/Passage one names/);

    await waitFor(() => expect(mockGetExcerpts).toHaveBeenCalled());
    expect(mockGetInstances).not.toHaveBeenCalled();
  });
});
