import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublishReadiness } from '@eightyfourthousand/client-graphql';
import { PublishChecksPanel } from './PublishChecksPanel';

const mockGetPublishReadiness = jest.fn();
const mockGetFindingLocations = jest.fn();
const mockGetPublishStatus = jest.fn();

// Only the network functions are stubbed. isReadinessUndetermined is deliberately left as
// the real implementation: it encodes the "could not check" rule this suite is testing, so
// mocking it would test nothing.
jest.mock('@eightyfourthousand/client-graphql', () => ({
  ...jest.requireActual('@eightyfourthousand/client-graphql'),
  createGraphQLClient: () => ({}),
  getPublishReadiness: (args: unknown) => mockGetPublishReadiness(args),
  getFindingLocations: (args: unknown) => mockGetFindingLocations(args),
  getPublishStatus: (args: unknown) => mockGetPublishStatus(args),
}));

// A cached row carrying the same findings the live check would have produced.
const cached = (readinessValue: PublishReadiness) => ({
  workUuid: WORK,
  ok: readinessValue.ok,
  errorCount: readinessValue.errors.length,
  warningCount: readinessValue.warnings.length,
  errorOccurrences: readinessValue.errors.reduce((t, f) => t + f.count, 0),
  warningOccurrences: readinessValue.warnings.reduce((t, f) => t + f.count, 0),
  errors: readinessValue.errors,
  warnings: readinessValue.warnings,
  checkedAt: '2026-08-04T10:00:00.000Z',
  draftTouchedAt: '2026-08-04T10:00:00.000Z',
  stale: false,
});

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
  mockGetPublishStatus.mockResolvedValue(null);
});

/**
 * Puts a verdict in the cache, and makes a live check return the same thing.
 *
 * The panel reads the cache on open and validates only on request, so presentation tests
 * go through the cached path; seeding both keeps them indifferent to which produced it.
 */
const seed = (value: PublishReadiness) => {
  mockGetPublishStatus.mockResolvedValue(cached(value));
  mockGetPublishReadiness.mockResolvedValue(value);
  return value;
};

const renderPanel = async () => {
  render(<PublishChecksPanel workUuid={WORK} />);
  await waitFor(() => expect(mockGetPublishStatus).toHaveBeenCalled());
};

describe('PublishChecksPanel', () => {
  it('reports an unpopulated glossary index as "could not check", not as a broken work', async () => {
    // The rule fires as an ERROR, so anything keying off severity alone would render this
    // as a validation failure. It means two glossary rules went unevaluated.
    seed(
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
    seed(
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
    seed(
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
            message:
              'Inline markers reference passages that are not in this snapshot.',
            subjects: ['c'],
            count: 2,
          },
        ],
      }),
    );

    await renderPanel();

    // 2 rules, 27 occurrences — not "3 subjects", which is all the capped lists contain.
    expect(
      await screen.findByText('2 rules, 27 blocking publication'),
    ).toBeTruthy();
  });

  it('reports the true occurrence total when the rule set capped the subject list', async () => {
    // The SQL caps subjects at 20 while counting them all. Showing 20 silently would read
    // as "20 affected" for a problem that touches 415.
    seed(
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
        name: /References that exist only as an xmlId with no resolved uuid/i,
      }),
    );

    expect(await screen.findByText(/Showing 20 of 415/i)).toBeTruthy();
  });

  it('paginates subjects rather than truncating them', async () => {
    seed(
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
        passageType: 'translation',
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
    seed(
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
        passageType: 'translation',
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
      await screen.findByRole('button', {
        name: /glossary-instance in 1\.24/i,
      }),
    );

    expect(mockUpdatePanel).toHaveBeenCalledWith({
      name: 'main',
      state: { open: true, tab: 'translation', hash: 'passage-9' },
    });
  });

  it('shows a subject that no longer exists rather than dropping it', async () => {
    seed(
      readiness({
        ok: false,
        errors: [
          {
            rule: 'inline-marker-unresolved',
            severity: 'error',
            message:
              'Inline markers reference passages that are not in this snapshot.',
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
        passageType: null,
        annotationType: null,
      },
    ]);

    await renderPanel();

    await userEvent.click(
      await screen.findByRole('button', {
        name: /Inline markers that do not resolve/i,
      }),
    );

    expect(await screen.findByText(/no longer in this work/i)).toBeTruthy();
  });

  describe('routes each subject to the panel it actually lives in', () => {
    const openFinding = async (locations: unknown[]) => {
      seed(
        readiness({
          ok: false,
          errors: [
            {
              rule: 'inline-marker-unresolved',
              severity: 'error',
              message: 'Inline markers reference targets not in this snapshot.',
              subjects: ['s1'],
              count: 1,
            },
          ],
        }),
      );
      mockGetFindingLocations.mockResolvedValue(locations);

      await renderPanel();
      await userEvent.click(
        await screen.findByRole('button', {
          name: /Inline markers that do not resolve/i,
        }),
      );
      await userEvent.click(await screen.findByRole('button', { name: /in / }));
    };

    const passageAt = (passageType: string | null) => [
      {
        uuid: 's1',
        kind: 'annotation' as const,
        passageUuid: 'p1',
        passageLabel: 'n.12',
        passageType,
        annotationType: 'end-note-link',
      },
    ];

    // The original implementation sent every one of these to main/translation, so the
    // panel opened and the passage simply was not there.
    it.each([
      ['endnotes', 'right', 'endnotes'],
      ['abbreviations', 'right', 'abbreviations'],
      ['introduction', 'main', 'front'],
      ['summary', 'main', 'front'],
      ['acknowledgment', 'main', 'front'],
      ['colophon', 'main', 'translation'],
      ['appendix', 'main', 'translation'],
      ['translation', 'main', 'translation'],
    ])('sends a %s passage to %s/%s', async (type, panel, tab) => {
      await openFinding(passageAt(type));

      expect(mockUpdatePanel).toHaveBeenCalledWith({
        name: panel,
        state: { open: true, tab, hash: 'p1' },
      });
    });

    it('treats a section header as part of its section', async () => {
      // Every section has a *Header passage for its heading row, and none of them appear
      // in the lookup tables.
      await openFinding(passageAt('endnotesHeader'));

      expect(mockUpdatePanel).toHaveBeenCalledWith({
        name: 'right',
        state: { open: true, tab: 'endnotes', hash: 'p1' },
      });
    });

    it('tolerates the stray whitespace present in production types', async () => {
      await openFinding(passageAt('abbreviations\n'));

      expect(mockUpdatePanel).toHaveBeenCalledWith({
        name: 'right',
        state: { open: true, tab: 'abbreviations', hash: 'p1' },
      });
    });

    it('falls back to the body for an unrecognized type', async () => {
      await openFinding(passageAt('somethingNew'));

      expect(mockUpdatePanel).toHaveBeenCalledWith({
        name: 'main',
        state: { open: true, tab: 'translation', hash: 'p1' },
      });
    });

    it('opens a bibliography entry in the bibliography tab, keyed by its own uuid', async () => {
      // These have no passage at all, and were previously rendered as dead text.
      seed(
        readiness({
          ok: false,
          errors: [
            {
              rule: 'bibliography-heading-unresolved',
              severity: 'error',
              message: 'Bibliography entries point at missing heading rows.',
              subjects: ['b1'],
              count: 1,
            },
          ],
        }),
      );
      mockGetFindingLocations.mockResolvedValue([
        {
          uuid: 'b1',
          kind: 'bibliography' as const,
          passageUuid: null,
          passageLabel: null,
          passageType: null,
          annotationType: null,
        },
      ]);

      await renderPanel();
      await userEvent.click(
        await screen.findByRole('button', {
          name: /Bibliography headings that do not resolve/i,
        }),
      );
      await userEvent.click(
        await screen.findByRole('button', { name: 'Bibliography entry' }),
      );

      expect(mockUpdatePanel).toHaveBeenCalledWith({
        name: 'right',
        state: { open: true, tab: 'bibliography', hash: 'b1' },
      });
    });
  });

  describe('reads the cache before validating', () => {
    const blocked = () =>
      readiness({
        ok: false,
        errors: [
          {
            rule: 'passage-sort-missing',
            severity: 'error',
            message: 'Passages have no sort value.',
            subjects: ['p1'],
            count: 1,
          },
        ],
      });

    it('shows the cached verdict without running a check', async () => {
      // Validation costs ~0.8 ms per passage — seconds on a long text — so merely opening
      // the tab must not trigger it.
      seed(blocked());

      await renderPanel();

      expect(
        await screen.findByText('1 rule, 1 blocking publication'),
      ).toBeTruthy();
      expect(mockGetPublishReadiness).not.toHaveBeenCalled();
    });

    it('says when the cached verdict was recorded', async () => {
      seed(blocked());

      await renderPanel();

      expect(await screen.findByText(/^Checked /)).toBeTruthy();
    });

    it('offers a check, and no verdict, when the work has never been checked', async () => {
      mockGetPublishStatus.mockResolvedValue(null);

      await renderPanel();

      expect(await screen.findByText('Not checked')).toBeTruthy();
      expect(screen.queryByText(/blocking publication/i)).toBeNull();
      expect(mockGetPublishReadiness).not.toHaveBeenCalled();
    });

    it('treats a superseded verdict as no verdict', async () => {
      // Checked, then edited. Showing the old answer as current is the failure this whole
      // view exists to avoid, so it is presented exactly like never-checked.
      mockGetPublishStatus.mockResolvedValue({
        ...cached(blocked()),
        stale: true,
        draftTouchedAt: '2026-08-04T12:00:00.000Z',
      });

      await renderPanel();

      expect(await screen.findByText('Not checked')).toBeTruthy();
      expect(screen.queryByText('1 rule, 1 blocking publication')).toBeNull();
    });

    it('validates when the editor asks, and then shows the result', async () => {
      mockGetPublishStatus.mockResolvedValue(null);
      mockGetPublishReadiness.mockResolvedValue(blocked());

      await renderPanel();
      await userEvent.click(
        await screen.findByRole('button', { name: 'Run check' }),
      );

      expect(
        await screen.findByText('1 rule, 1 blocking publication'),
      ).toBeTruthy();
      expect(mockGetPublishReadiness).toHaveBeenCalledTimes(1);
    });

    it('re-checks a cached verdict on request', async () => {
      seed(blocked());

      await renderPanel();
      await screen.findByText('1 rule, 1 blocking publication');

      await userEvent.click(
        await screen.findByRole('button', { name: 'Re-check' }),
      );

      await waitFor(() =>
        expect(mockGetPublishReadiness).toHaveBeenCalledTimes(1),
      );
    });
  });

  describe('the Diagnostics section', () => {
    const toggle = () =>
      userEvent.click(screen.getByRole('button', { name: /Diagnostics/ }));

    const blocked = () =>
      readiness({
        ok: false,
        errors: [
          {
            rule: 'passage-sort-missing',
            severity: 'error',
            message: 'Passages have no sort value.',
            subjects: ['p1'],
            count: 1,
          },
        ],
      });

    it('starts open, so blocking findings are not hidden by default', async () => {
      // The publish button sits above this in the panel. A default that concealed the
      // reasons a work cannot be published would be actively misleading there.
      seed(blocked());

      await renderPanel();

      expect(
        await screen.findByText('1 rule, 1 blocking publication'),
      ).toBeTruthy();
    });

    it('collapses and reopens the findings', async () => {
      seed(blocked());

      await renderPanel();
      await screen.findByText('1 rule, 1 blocking publication');

      await toggle();
      expect(screen.queryByText('1 rule, 1 blocking publication')).toBeNull();

      await toggle();
      expect(
        await screen.findByText('1 rule, 1 blocking publication'),
      ).toBeTruthy();
    });

    it('does not run a check when toggled', async () => {
      // Validation costs roughly 0.8 ms per passage, so seconds on a long work. Tying it to
      // a disclosure control would charge that price for tidying the panel.
      seed(blocked());

      await renderPanel();
      await screen.findByText('1 rule, 1 blocking publication');

      await toggle();
      await toggle();

      expect(mockGetPublishReadiness).not.toHaveBeenCalled();
    });

    it('keeps the re-check control reachable while collapsed', async () => {
      seed(blocked());

      await renderPanel();
      await screen.findByText('1 rule, 1 blocking publication');
      await toggle();

      await userEvent.click(screen.getByRole('button', { name: 'Re-check' }));

      await waitFor(() =>
        expect(mockGetPublishReadiness).toHaveBeenCalledTimes(1),
      );
    });

    it('offers no re-check icon before a verdict exists', async () => {
      // The unchecked state carries its own labelled "Run check" button next to the sentence
      // explaining why, so an icon here would be a second control for the same action.
      mockGetPublishStatus.mockResolvedValue(null);

      await renderPanel();

      expect(await screen.findByText('Not checked')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Re-check' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Run check' })).toBeTruthy();
    });
  });
});
