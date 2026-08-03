import { isPublishStatusKnown, isStale, type WorkPublishStatus } from './types';

/**
 * Staleness is the property the whole publish-status cache rests on: it is what lets a
 * recorded verdict be trusted, and getting it backwards would show a superseded answer as
 * current. These cases are the ones where a naive implementation goes wrong.
 */
describe('isStale', () => {
  it('is false when the verdict postdates the last edit', () => {
    expect(
      isStale('2026-08-03T16:41:22.5+00:00', '2026-08-03T16:41:20.1+00:00'),
    ).toBe(false);
  });

  it('is true when the draft changed after the verdict', () => {
    expect(
      isStale('2026-08-03T16:41:20.1+00:00', '2026-08-03T16:41:22.5+00:00'),
    ).toBe(true);
  });

  it('is false when they are the same instant', () => {
    // validate_and_record_work writes both columns from one clock reading on first insert,
    // so an equal pair is the normal freshly-checked case and must not read as stale.
    const at = '2026-08-03T16:41:22.123456+00:00';
    expect(isStale(at, at)).toBe(false);
  });

  it('is false when the work has never been checked', () => {
    // Never-checked is handled as "no verdict" elsewhere; it is not a stale verdict.
    expect(isStale(null, '2026-08-03T16:41:22+00:00')).toBe(false);
  });

  it('compares instants, not strings, across differing fractional precision', () => {
    // Postgres trims trailing zeros, so precision varies row to row. The later instant here
    // sorts EARLIER lexicographically ('0' < '1'), which is what a string comparison gets
    // wrong.
    expect(
      isStale('2026-08-03T16:41:22.1+00:00', '2026-08-03T16:41:22.09+00:00'),
    ).toBe(false);
    expect(
      isStale('2026-08-03T16:41:22.09+00:00', '2026-08-03T16:41:22.1+00:00'),
    ).toBe(true);
  });

  it('compares instants, not strings, across differing UTC offsets', () => {
    // Checked at 18:00Z, touched at 19:00+02:00 — which is 17:00Z, an hour EARLIER, so the
    // verdict still holds. The touch sorts later as a string ('19' > '18'), so a string
    // comparison would wrongly mark this stale.
    expect(
      isStale('2026-08-03T18:00:00+00:00', '2026-08-03T19:00:00+02:00'),
    ).toBe(false);
  });

  it('treats an unparseable timestamp as stale rather than current', () => {
    // Failing closed: a verdict we cannot date must not be presented as trustworthy.
    expect(isStale('not-a-timestamp', '2026-08-03T16:41:22+00:00')).toBe(true);
  });
});

const status = (overrides: Partial<WorkPublishStatus>): WorkPublishStatus => ({
  workUuid: 'w1',
  ok: true,
  errorCount: 0,
  warningCount: 0,
  errorOccurrences: 0,
  warningOccurrences: 0,
  errors: [],
  warnings: [],
  checkedAt: '2026-08-03T16:41:22+00:00',
  draftTouchedAt: '2026-08-03T16:41:22+00:00',
  stale: false,
  ...overrides,
});

describe('isPublishStatusKnown', () => {
  it('is true only for a verdict that was recorded and still holds', () => {
    expect(isPublishStatusKnown(status({}))).toBe(true);
  });

  it('is false when the work has no cached row at all', () => {
    expect(isPublishStatusKnown(undefined)).toBe(false);
  });

  it('is false when the work has never been checked', () => {
    expect(isPublishStatusKnown(status({ checkedAt: null, ok: null }))).toBe(
      false,
    );
  });

  it('is false when the verdict has been superseded', () => {
    // Crucially this holds even though ok is true: a stale pass is not a pass.
    expect(isPublishStatusKnown(status({ stale: true, ok: true }))).toBe(false);
  });
});
