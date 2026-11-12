import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { locationForPassageType } from '../types';
import { GlossaryInstancesTable } from './GlossaryInstancesTable';

// Acceptance tests for DEV-912, criteria 2 (a row per instance), 3 (order and
// paging), 4 (the table reads the entry and Toh the dialog counts) and 5
// (jump). The table is driven through the public client-graphql read, which is
// mocked with a server that answers any offset from a fixed list.

const PAGE = 50;

type Instance = {
  uuid: string;
  passageUuid: string;
  passageLabel: string | null;
  passageType: string;
  passageSort: number;
  start: number;
  end: number;
  before: string;
  text: string;
  after: string;
  truncatedStart: boolean;
  truncatedEnd: boolean;
  outOfRange: boolean;
};

const instance = (i: number, overrides: Partial<Instance> = {}): Instance => ({
  uuid: `a-${i}`,
  passageUuid: `p-${i}`,
  passageLabel: `1.${i + 1}`,
  passageType: 'translation',
  passageSort: i + 1,
  start: 400 + i,
  end: 411 + i,
  before: 'the earlier words',
  text: 'bodhisattva',
  after: 'and the later words',
  truncatedStart: false,
  truncatedEnd: false,
  outOfRange: false,
  ...overrides,
});

const mockUpdatePanel = jest.fn();
const mockNavigation = { toh: 'toh8', updatePanel: mockUpdatePanel };
const mockGetInstances = jest.fn();
let dataset: (index: number) => Instance;
let total = 0;

jest.mock('../NavigationContext', () => ({
  useNavigation: () => mockNavigation,
}));
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  getGlossaryTermInstances: (...args: unknown[]) => mockGetInstances(...args),
}));

const serve = (count: number, make: (i: number) => Instance = instance) => {
  total = count;
  dataset = make;
  mockGetInstances.mockImplementation(
    async ({
      offset = 0,
      first = PAGE,
    }: {
      offset?: number;
      first?: number;
    }) => ({
      items: Array.from(
        { length: Math.max(0, Math.min(first, count - offset)) },
        (_, k) => make(offset + k),
      ),
      totalCount: count,
      offset,
    }),
  );
};

const onClose = jest.fn();

const renderTable = () =>
  render(<GlossaryInstancesTable termUuid="term-1" onClose={onClose} />);

const table = () => screen.findByRole('table', { name: 'Instances' });

/** The passage-label buttons, one per row on the page. */
const labelButtons = () =>
  within(screen.getByRole('table', { name: 'Instances' })).queryAllByRole(
    'button',
    { name: /^1\.\d+$/ },
  );

const labels = () => labelButtons().map((b) => b.textContent);

const pager = () => screen.getByRole('navigation', { name: 'Instance pages' });
const pagerButton = (name: RegExp) =>
  within(pager()).getByRole('button', { name });

const offsetsRequested = () =>
  mockGetInstances.mock.calls.map(
    ([args]) => (args as { offset?: number }).offset ?? 0,
  );

beforeEach(() => {
  mockUpdatePanel.mockReset();
  mockGetInstances.mockReset();
  onClose.mockReset();
  window.history.replaceState(null, '', '/');
});

describe('DEV-912 criterion 2: one row per instance', () => {
  it('criterion 2: the table has Passage, Text and Offsets columns', async () => {
    serve(3);
    renderTable();

    const instances = await table();

    for (const name of ['Passage', 'Text', 'Offsets']) {
      expect(
        within(instances).getByRole('columnheader', { name }),
      ).toBeTruthy();
    }
  });

  it('criterion 2: each instance is a row with its passage label as a button', async () => {
    serve(3);
    renderTable();
    await table();

    expect(await screen.findByRole('button', { name: '1.1' })).toBeTruthy();
    expect(labels()).toEqual(['1.1', '1.2', '1.3']);
  });

  it('criterion 2: a row shows the matched text with the words either side of it', async () => {
    serve(2);
    renderTable();
    await table();

    const row = (await screen.findByRole('button', { name: '1.2' })).closest(
      'tr',
    ) as HTMLElement;

    expect(row.textContent).toContain('the earlier words');
    expect(row.textContent).toContain('bodhisattva');
    expect(row.textContent).toContain('and the later words');
  });

  it("criterion 2: a row shows the instance's start and end offsets", async () => {
    serve(1, (i) => instance(i, { start: 1234, end: 1241 }));
    renderTable();
    await table();

    const row = (await screen.findByRole('button', { name: '1.1' })).closest(
      'tr',
    ) as HTMLElement;

    expect(row.textContent).toMatch(/1,?234\D+1,?241/);
  });

  it('criterion 2: two instances in one passage are two rows', async () => {
    serve(2, (i) =>
      instance(i, {
        passageUuid: 'p-same',
        passageLabel: '1.9',
        passageSort: 9,
        start: 10 + i * 100,
        end: 21 + i * 100,
      }),
    );
    renderTable();
    await table();

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: '1.9' })).toHaveLength(2),
    );
  });

  it('criterion 2 (risk note): an instance whose offsets are outside the text shows as a row, and the page still loads', async () => {
    serve(3, (i) =>
      i === 1
        ? instance(i, {
            outOfRange: true,
            before: '',
            text: '',
            after: '',
            start: 9000,
            end: 9011,
          })
        : instance(i),
    );
    renderTable();
    await table();

    await waitFor(() => expect(labels()).toEqual(['1.1', '1.2', '1.3']));
  });

  it('criterion 2: a passage without a label still has a row', async () => {
    serve(2, (i) => instance(i, i === 0 ? { passageLabel: null } : {}));
    renderTable();
    await table();

    await waitFor(() =>
      expect(
        within(screen.getByRole('table', { name: 'Instances' })).getAllByRole(
          'button',
        ).length,
      ).toBeGreaterThanOrEqual(2),
    );
    expect(labels()).toContain('1.2');
  });
});

describe('DEV-912 criterion 3: order and paging', () => {
  it('criterion 3: shows the total instance count', async () => {
    serve(18697);
    renderTable();

    expect(await screen.findByText(/18,?697 instances/)).toBeTruthy();
  });

  it('criterion 3: loads the first 50 rows only, from the server, in the order served', async () => {
    serve(18697);
    renderTable();
    await table();

    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));
    expect(labels()[0]).toBe('1.1');
    expect(labels()[PAGE - 1]).toBe('1.50');
    expect(offsetsRequested()).toEqual([0]);
    const [first] = mockGetInstances.mock.calls[0];
    expect(first.first === undefined || first.first === PAGE).toBe(true);
  });

  it('criterion 3: the pager says which page of how many, at 50 rows a page', async () => {
    serve(18697);
    renderTable();
    await table();

    expect(await within(pager()).findByText(/page 1 of 374/i)).toBeTruthy();
  });

  it('criterion 3: Next loads the next page a page at a time', async () => {
    serve(18697);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));

    await userEvent.click(pagerButton(/next/i));

    await waitFor(() => expect(labels()[0]).toBe('1.51'));
    expect(labelButtons()).toHaveLength(PAGE);
    expect(within(pager()).getByText(/page 2 of 374/i)).toBeTruthy();
    expect(offsetsRequested()).toEqual([0, 50]);
  });

  it('criterion 3: Previous goes back a page', async () => {
    serve(18697);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));
    await userEvent.click(pagerButton(/next/i));
    await waitFor(() => expect(labels()[0]).toBe('1.51'));

    await userEvent.click(pagerButton(/previous/i));

    await waitFor(() => expect(labels()[0]).toBe('1.1'));
    expect(within(pager()).getByText(/page 1 of 374/i)).toBeTruthy();
  });

  it('criterion 3: for the heaviest term, Last reaches the last page and its 47 rows', async () => {
    serve(18697);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));

    await userEvent.click(pagerButton(/last/i));

    await waitFor(() => expect(labels()[0]).toBe('1.18651'));
    expect(labelButtons()).toHaveLength(18697 - 18650);
    expect(labels()[46]).toBe('1.18697');
    expect(within(pager()).getByText(/page 374 of 374/i)).toBeTruthy();
    expect(offsetsRequested()).toEqual([0, 18650]);
  });

  it('criterion 3: First returns to the first page from the last', async () => {
    serve(18697);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));
    await userEvent.click(pagerButton(/last/i));
    await waitFor(() => expect(labels()[0]).toBe('1.18651'));

    await userEvent.click(pagerButton(/first/i));

    await waitFor(() => expect(labels()[0]).toBe('1.1'));
    expect(offsetsRequested().slice(-1)).toEqual([0]);
  });

  it('criterion 3: there is nowhere past the last page to go', async () => {
    serve(18697);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));
    await userEvent.click(pagerButton(/last/i));
    await waitFor(() => expect(labels()[0]).toBe('1.18651'));
    const reads = mockGetInstances.mock.calls.length;

    await userEvent.click(pagerButton(/next/i));
    await userEvent.click(pagerButton(/last/i));

    expect(mockGetInstances.mock.calls.length).toBe(reads);
    expect(within(pager()).getByText(/page 374 of 374/i)).toBeTruthy();
  });

  it('criterion 3: there is nowhere before the first page to go', async () => {
    serve(18697);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));
    const reads = mockGetInstances.mock.calls.length;

    await userEvent.click(pagerButton(/previous/i));
    await userEvent.click(pagerButton(/first/i));

    expect(mockGetInstances.mock.calls.length).toBe(reads);
    expect(within(pager()).getByText(/page 1 of 374/i)).toBeTruthy();
  });

  it('criterion 3: an exact multiple of 50 ends on a full last page', async () => {
    serve(100);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));

    await userEvent.click(pagerButton(/last/i));

    await waitFor(() => expect(labels()[0]).toBe('1.51'));
    expect(labelButtons()).toHaveLength(PAGE);
    expect(within(pager()).getByText(/page 2 of 2/i)).toBeTruthy();
  });

  it('criterion 3: a term with an instance count under a page has one page', async () => {
    serve(7);
    renderTable();
    await table();

    await waitFor(() => expect(labelButtons()).toHaveLength(7));
    expect(within(pager()).getByText(/page 1 of 1/i)).toBeTruthy();
    expect(await screen.findByText(/7 instances/)).toBeTruthy();
  });
});

describe('DEV-912 criterion 4: the same entry and Toh as the passages dialog', () => {
  it('criterion 4: reads the instances of the entry the dialog was opened on, in the current Toh', async () => {
    serve(3);
    renderTable();
    await table();

    await waitFor(() => expect(mockGetInstances).toHaveBeenCalled());
    expect(mockGetInstances.mock.calls[0][0]).toMatchObject({
      uuid: 'term-1',
      toh: 'toh8',
    });
  });

  it('criterion 4: every page read names the entry and the Toh', async () => {
    serve(120);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));

    await userEvent.click(pagerButton(/next/i));
    await waitFor(() => expect(labels()[0]).toBe('1.51'));

    for (const [args] of mockGetInstances.mock.calls) {
      expect(args).toMatchObject({ uuid: 'term-1', toh: 'toh8' });
    }
  });
});

describe('DEV-912 criterion 5: jump', () => {
  it('criterion 5: clicking the passage label closes the dialog', async () => {
    serve(3);
    renderTable();
    await table();

    await userEvent.click(await screen.findByRole('button', { name: '1.2' }));

    expect(onClose).toHaveBeenCalled();
  });

  it("criterion 5: the instance's range goes in the start and end URL params, to be selected", async () => {
    serve(3, (i) => instance(i, { start: 1234 + i, end: 1245 + i }));
    renderTable();
    await table();

    await userEvent.click(await screen.findByRole('button', { name: '1.2' }));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('start')).toBe('1235');
    expect(params.get('end')).toBe('1246');
  });

  it('criterion 5: opens the panel on the passage, in the place its type belongs', async () => {
    serve(3);
    renderTable();
    await table();

    await userEvent.click(await screen.findByRole('button', { name: '1.3' }));

    const { panel, tab } = locationForPassageType('translation');
    expect(mockUpdatePanel).toHaveBeenCalledTimes(1);
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: panel,
      state: expect.objectContaining({ open: true, tab, hash: 'p-2' }),
    });
  });

  it("criterion 5: a passage outside the translation body opens in its type's panel and tab", async () => {
    serve(2, (i) => instance(i, i === 1 ? { passageType: 'endnotes' } : {}));
    renderTable();
    await table();

    await userEvent.click(await screen.findByRole('button', { name: '1.2' }));

    const { panel, tab } = locationForPassageType('endnotes');
    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: panel,
      state: expect.objectContaining({ open: true, tab, hash: 'p-1' }),
    });
  });

  it('criterion 5: a second jump replaces the range of the first', async () => {
    serve(3, (i) =>
      instance(i, { start: 100 * (i + 1), end: 100 * (i + 1) + 8 }),
    );
    renderTable();
    await table();

    await userEvent.click(await screen.findByRole('button', { name: '1.1' }));
    await userEvent.click(await screen.findByRole('button', { name: '1.3' }));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('start')).toBe('300');
    expect(params.get('end')).toBe('308');
  });

  it("criterion 5: a jump from the second page uses that page's instance", async () => {
    serve(120);
    renderTable();
    await table();
    await waitFor(() => expect(labelButtons()).toHaveLength(PAGE));
    await userEvent.click(pagerButton(/next/i));
    await waitFor(() => expect(labels()[0]).toBe('1.51'));

    await userEvent.click(screen.getByRole('button', { name: '1.52' }));

    const params = new URLSearchParams(window.location.search);
    expect(params.get('start')).toBe(String(dataset(51).start));
    expect(params.get('end')).toBe(String(dataset(51).end));
    expect(mockUpdatePanel).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({ hash: 'p-51' }),
      }),
    );
    expect(total).toBe(120);
  });
});
