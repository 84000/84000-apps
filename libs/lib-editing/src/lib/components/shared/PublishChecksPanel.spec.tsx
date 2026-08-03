import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublishReadiness } from '@eightyfourthousand/client-graphql';
import { PublishChecksPanel } from './PublishChecksPanel';

const mockGetPublishReadiness = jest.fn();
const mockGetFindingLocations = jest.fn();

// Only the network functions are stubbed. isReadinessUndetermined is deliberately left as
// the real implementation: it encodes the "could not check" rule this suite is testing, so
// mocking it would test nothing.
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  getPublishReadiness: (args: unknown) => mockGetPublishReadiness(args),
  getFindingLocations: (args: unknown) => mockGetFindingLocations(args),
}));

const mockUpdatePanel = jest.fn();
jest.mock('./NavigationProvider', () => ({
  useNavigation: () => ({ updatePanel: mockUpdatePanel }),
}));

const WORK = '11111111-1111-1111-1111-111111111111';

const readiness = (overrides: Partial<PublishReadiness>): PublishReadiness => ({
  ok: true,
  errors: [],
  warnings: [],
  ...overrides,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetFindingLocations.mockResolvedValue([]);
});

const renderPanel = async () => {
  render(<PublishChecksPanel workUuid={WORK} />);
  await waitFor(() => expect(mockGetPublishReadiness).toHaveBeenCalled());
};

describe('PublishChecksPanel', () => {
  it('reports an unpopulated glossary index as "could not check", not as a broken work', async () => {
    // The rule fires as an ERROR, so anything keying off severity alone would render this
    // as a validation failure. It means two glossary rules went unevaluated.
    mockGetPublishReadiness.mockResolvedValue(
      readiness({
        ok: false,
        errors: [
          {
            rule: 'glossary-index-unavailable',
            severity: 'error',
            message:
              'The glossary_term_index materialized view is not populated, so glossary references cannot be validated. Refresh it and re-check.',
            subjects: [],
            count: 0,
          },
        ],
      }),
    );

    await renderPanel();

    expect(await screen.findByText('Could not check')).toBeTruthy();
    expect(
      screen.getByText(/it is the check that is unavailable/i),
    ).toBeTruthy();
    // Must not claim anything about publishability either way.
    expect(screen.queryByText(/blocking publication/i)).toBeNull();
  });

  it('labels warnings as non-blocking and keeps them out of the blocking count', async () => {
    mockGetPublishReadiness.mockResolvedValue(
      readiness({
        ok: true,
        warnings: [
          {
            rule: 'bibliography-empty',
            severity: 'warning',
            message: 'The work has no bibliography entries.',
            subjects: [],
            count: 0,
          },
        ],
      }),
    );

    await renderPanel();

    expect(
      await screen.findByText('No problems blocking publication'),
    ).toBeTruthy();
    expect(screen.getByText('do not block publishing')).toBeTruthy();
  });

  it('counts blocking rules and occurrences separately', async () => {
    mockGetPublishReadiness.mockResolvedValue(
      readiness({
        ok: false,
        errors: [
          {
            rule: 'xmlid-strip-orphan',
            severity: 'error',
            message: 'Annotations reference targets only by deprecated xmlId.',
            subjects: ['a', 'b'],
            count: 25,
          },
          {
            rule: 'inline-marker-unresolved',
            severity: 'error',
            message: 'Inline markers reference passages that are not in this snapshot.',
            subjects: ['c'],
            count: 2,
          },
        ],
      }),
    );

    await renderPanel();

    // 2 rules, 27 occurrences — not "3 subjects", which is all the capped lists contain.
    expect(await screen.findByText('2 rules, 27 blocking publication')).toBeTruthy();
  });

  it('reports the true occurrence total when the rule set capped the subject list', async () => {
    // The SQL caps subjects at 20 while counting them all. Showing 20 silently would read
    // as "20 affected" for a problem that touches 415.
    mockGetPublishReadiness.mockResolvedValue(
      readiness({
        ok: false,
        errors: [
          {
            rule: 'xmlid-strip-orphan',
            severity: 'error',
            message: 'Annotations reference targets only by deprecated xmlId.',
            subjects: Array.from({ length: 20 }, (_, i) => `uuid-${i}`),
            count: 415,
          },
        ],
      }),
    );

    await renderPanel();

    await userEvent.click(
      await screen.findByRole('button', {
        name: /References that exist only as a deprecated xmlId/i,
      }),
    );

    expect(
      await screen.findByText(/Showing 20 of 415/i),
    ).toBeTruthy();
  });

  it('paginates subjects rather than truncating them', async () => {
    mockGetPublishReadiness.mockResolvedValue(
      readiness({
        ok: false,
        errors: [
          {
            rule: 'passage-sort-missing',
            severity: 'error',
            message: 'Passages have no sort value.',
            subjects: Array.from({ length: 15 }, (_, i) => `uuid-${i}`),
            count: 15,
          },
        ],
      }),
    );
    mockGetFindingLocations.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({
        uuid: `uuid-${i}`,
        kind: 'passage' as const,
        passageUuid: `uuid-${i}`,
        passageLabel: `Passage ${i}`,
        annotationType: null,
      })),
    );

    await renderPanel();

    await userEvent.click(
      await screen.findByRole('button', {
        name: /Passages without a sort value/i,
      }),
    );

    // 15 subjects at 10 per page: page one holds 0-9, page two the rest.
    expect(await screen.findByText('Passage 0')).toBeTruthy();
    expect(screen.queryByText('Passage 14')).toBeNull();
    expect(screen.getByText('1 / 2')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Passage 14')).toBeTruthy();
    expect(screen.queryByText('Passage 0')).toBeNull();
  });

  it('navigates to the passage a finding sits in', async () => {
    mockGetPublishReadiness.mockResolvedValue(
      readiness({
        ok: false,
        errors: [
          {
            rule: 'glossary-instance-unresolved',
            severity: 'error',
            message: 'glossary-instance annotations reference missing terms.',
            subjects: ['annotation-1'],
            count: 1,
          },
        ],
      }),
    );
    mockGetFindingLocations.mockResolvedValue([
      {
        uuid: 'annotation-1',
        kind: 'annotation' as const,
        passageUuid: 'passage-9',
        passageLabel: '1.24',
        annotationType: 'glossary-instance',
      },
    ]);

    await renderPanel();

    await userEvent.click(
      await screen.findByRole('button', {
        name: /Glossary references that do not resolve/i,
      }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /glossary-instance in 1\.24/i }),
    );

    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'main',
      state: { open: true, tab: 'translation', hash: 'passage-9' },
    });
  });

  it('shows a subject that no longer exists rather than dropping it', async () => {
    mockGetPublishReadiness.mockResolvedValue(
      readiness({
        ok: false,
        errors: [
          {
            rule: 'inline-marker-unresolved',
            severity: 'error',
            message: 'Inline markers reference passages that are not in this snapshot.',
            subjects: ['gone-1'],
            count: 1,
          },
        ],
      }),
    );
    mockGetFindingLocations.mockResolvedValue([
      {
        uuid: 'gone-1',
        kind: 'unknown' as const,
        passageUuid: null,
        passageLabel: null,
        annotationType: null,
      },
    ]);

    await renderPanel();

    await userEvent.click(
      await screen.findByRole('button', {
        name: /Inline markers that do not resolve/i,
      }),
    );

    expect(
      await screen.findByText(/no longer in this work/i),
    ).toBeTruthy();
  });
});
