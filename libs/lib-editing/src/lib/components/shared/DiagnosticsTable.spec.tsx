import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TooltipProvider } from '@eightyfourthousand/design-system';
import { Work } from '@eightyfourthousand/data-access';
import type { WorkPublishStatus } from '@eightyfourthousand/client-graphql';
import { DiagnosticsTable } from './DiagnosticsTable';

const mockGetPublishStatuses = jest.fn();
const mockGetPublishReadiness = jest.fn();

// publishStatusKind is left real: it decides what each row claims about a work, which is
// what these tests are checking.
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  getPublishStatuses: () => mockGetPublishStatuses(),
  getPublishReadiness: (args: unknown) => mockGetPublishReadiness(args),
}));

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
  usePathname: () => '/translations/editor',
}));

const work = (uuid: string, title: string, toh: string): Work =>
  ({
    uuid,
    title,
    toh: [toh],
    publicationDate: undefined,
    publicationVersion: '1.0.0',
    pages: 10,
    restriction: false,
    section: 'Discourses',
  }) as Work;

const WORKS: Work[] = [
  work('w1', 'The Play in Full', 'toh95'),
  work('w2', 'A Multitude of Buddhas', 'toh12'),
  work('w3', 'Ornament of Awareness', 'toh1206'),
];

const status = (
  workUuid: string,
  overrides: Partial<WorkPublishStatus>,
): WorkPublishStatus => ({
  workUuid,
  ok: true,
  errorCount: 0,
  warningCount: 0,
  errorOccurrences: 0,
  warningOccurrences: 0,
  errors: [],
  warnings: [],
  checkedAt: '2026-08-04T10:00:00+00:00',
  draftTouchedAt: '2026-08-04T10:00:00+00:00',
  stale: false,
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetPublishStatuses.mockResolvedValue([]);
  mockGetPublishReadiness.mockResolvedValue({ ok: true, errors: [], warnings: [] });
});

const renderTable = async () => {
  render(
    <TooltipProvider>
      <DiagnosticsTable works={WORKS} />
    </TooltipProvider>,
  );
  await waitFor(() => expect(mockGetPublishStatuses).toHaveBeenCalled());
};

const bulkButton = () => screen.getByRole('button', { name: /^Check \d+ works?$/ });

describe('DiagnosticsTable bulk check', () => {
  it('counts every work when nothing is filtered', async () => {
    await renderTable();
    expect(await screen.findByText('Check 3 works')).toBeTruthy();
  });

  it('follows the search filter, in both label and effect', async () => {
    await renderTable();
    await screen.findByText('Check 3 works');

    await userEvent.type(
      screen.getByPlaceholderText('Search translations...'),
      'Ornament',
    );

    // Singular, and only the matching work — the filter is the selection.
    await waitFor(() => expect(screen.getByText('Check 1 work')).toBeTruthy());

    await userEvent.click(bulkButton());

    await waitFor(() => expect(mockGetPublishReadiness).toHaveBeenCalledTimes(1));
    expect(mockGetPublishReadiness).toHaveBeenCalledWith(
      expect.objectContaining({ work: 'w3' }),
    );
  });

  it('follows the "cannot publish only" toggle', async () => {
    mockGetPublishStatuses.mockResolvedValue([
      status('w1', { ok: false, errorCount: 1, errorOccurrences: 4 }),
      status('w2', { ok: true }),
      status('w3', { ok: true }),
    ]);

    await renderTable();
    await screen.findByText('Check 3 works');

    await userEvent.click(screen.getByLabelText('Cannot publish only'));

    await waitFor(() => expect(screen.getByText('Check 1 work')).toBeTruthy());

    await userEvent.click(bulkButton());

    await waitFor(() => expect(mockGetPublishReadiness).toHaveBeenCalledTimes(1));
    expect(mockGetPublishReadiness).toHaveBeenCalledWith(
      expect.objectContaining({ work: 'w1' }),
    );
  });

  it('re-checks works that already have a verdict', async () => {
    // The filter is the selection, so a filtered set of already-checked works is still a
    // valid thing to ask for — the count on the button has to match the rows on screen.
    mockGetPublishStatuses.mockResolvedValue([
      status('w1', {}),
      status('w2', {}),
      status('w3', {}),
    ]);

    await renderTable();

    await userEvent.click(await screen.findByText('Check 3 works'));

    await waitFor(() => expect(mockGetPublishReadiness).toHaveBeenCalledTimes(3));
  });

  it('refreshes the cached verdicts once the run finishes', async () => {
    await renderTable();
    expect(mockGetPublishStatuses).toHaveBeenCalledTimes(1);

    await userEvent.click(await screen.findByText('Check 3 works'));

    await waitFor(() => expect(mockGetPublishStatuses).toHaveBeenCalledTimes(2));
  });
});

describe('DiagnosticsTable per-row check', () => {
  const rowButton = (title: string) =>
    screen.getByRole('button', { name: new RegExp(`check ${title}`, 'i') });

  it('offers "Check" for an unchecked work and "Re-check" once it has a verdict', async () => {
    mockGetPublishStatuses.mockResolvedValue([status('w1', {})]);

    await renderTable();

    expect(
      await screen.findByRole('button', { name: 'Re-check The Play in Full' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Check A Multitude of Buddhas' }),
    ).toBeTruthy();
  });

  it('checks only the work whose button was clicked', async () => {
    await renderTable();

    await userEvent.click(await screen.findByRole('button', {
      name: 'Check A Multitude of Buddhas',
    }));

    await waitFor(() => expect(mockGetPublishReadiness).toHaveBeenCalledTimes(1));
    expect(mockGetPublishReadiness).toHaveBeenCalledWith(
      expect.objectContaining({ work: 'w2' }),
    );
  });

  it('reloads statuses after a single check', async () => {
    await renderTable();
    expect(mockGetPublishStatuses).toHaveBeenCalledTimes(1);

    await userEvent.click(await screen.findByRole('button', {
      name: 'Check The Play in Full',
    }));

    await waitFor(() => expect(mockGetPublishStatuses).toHaveBeenCalledTimes(2));
  });

  it('disables a row button while that work is in flight', async () => {
    let release: (() => void) | undefined;
    mockGetPublishReadiness.mockImplementation(
      () =>
        new Promise((resolve) => {
          release = () => resolve({ ok: true, errors: [], warnings: [] });
        }),
    );

    await renderTable();
    const button = await screen.findByRole('button', {
      name: 'Check The Play in Full',
    });
    await userEvent.click(button);

    await waitFor(() =>
      expect(
        (rowButton('The Play in Full') as HTMLButtonElement).disabled,
      ).toBe(true),
    );

    release?.();
    await waitFor(() => expect(mockGetPublishStatuses).toHaveBeenCalledTimes(2));
  });

  it('does not navigate when the row button is clicked', async () => {
    // The cell deliberately has no onCellClick; inheriting the row's would open the work
    // instead of checking it.
    await renderTable();

    const row = (await screen.findByText('The Play in Full')).closest('tr');
    await userEvent.click(
      within(row as HTMLElement).getByRole('button', {
        name: 'Check The Play in Full',
      }),
    );

    await waitFor(() => expect(mockGetPublishReadiness).toHaveBeenCalled());
    expect(mockGetPublishReadiness).toHaveBeenCalledWith(
      expect.objectContaining({ work: 'w1' }),
    );
  });
});
