import {
  additionKey,
  auditSettings,
  orderBatches,
  sanitizeBatch,
  type ReviewBatch,
  type ReviewDecider,
} from './review-batch';

const batch = (
  decider: ReviewDecider,
  recordedAt: string,
  parts: Partial<ReviewBatch> = {},
): ReviewBatch => ({
  version: 1,
  batchId: `b-${recordedAt}`,
  workUuid: 'w',
  recordedAt,
  recordedBy: 'u',
  decider,
  rules: [],
  instances: [],
  additions: [],
  ...parts,
});

describe('orderBatches', () => {
  it('orders by server time, then batch id', () => {
    const a = batch('model', '2026-10-13T00:00:02.000Z');
    const b = batch('model', '2026-10-13T00:00:01.000Z', { batchId: 'z' });
    const c = batch('model', '2026-10-13T00:00:01.000Z', { batchId: 'y' });
    expect(orderBatches([a, b, c])).toEqual([c, b, a]);
  });
});

describe('auditSettings', () => {
  it("takes the latest editor's settings and ignores the model's", () => {
    expect(
      auditSettings([
        batch('editor', '2026-10-13T00:00:01.000Z', {
          settings: { sampleSize: 5 },
        }),
        batch('model', '2026-10-13T00:00:02.000Z', {
          settings: { sampleSize: 0, maxSampleErrors: 9 },
        }),
        batch('editor', '2026-10-13T00:00:03.000Z', {
          settings: { maxSampleErrors: 2 },
        }),
      ]),
    ).toEqual({ sampleSize: 5, maxSampleErrors: 2 });
    expect(auditSettings([])).toEqual({ sampleSize: 20, maxSampleErrors: 1 });
  });
});

describe('sanitizeBatch', () => {
  it('drops malformed entries and counts them', () => {
    const { batch: clean, dropped } = sanitizeBatch(
      batch('model', '2026-10-13T00:00:01.000Z', {
        rules: [
          { termUuid: 't', verdict: 'accept' },
          { verdict: 'accept' },
          { termUuid: 't', verdict: 'skip', followedBy: '  ' },
          { termUuid: 't', verdict: 'maybe' as never },
        ],
        instances: [
          { key: 'c-1', verdict: 'skip' },
          { key: '', verdict: 'skip' },
        ],
        additions: [
          { passageUuid: 'p', text: 'x', termUuid: 't' },
          { passageUuid: 'p', text: 'x', termUuid: 't', occurrence: 0 },
        ],
      }),
    );
    expect(dropped).toBe(5);
    expect(clean.rules).toEqual([{ termUuid: 't', verdict: 'accept' }]);
    expect(clean.instances).toHaveLength(1);
    expect(clean.additions).toHaveLength(1);
  });
});

describe('additionKey', () => {
  it("keys an addition by its term, so an editor's check never carries to another term", () => {
    const a = { passageUuid: 'p0', text: 'x', termUuid: 'a' };
    expect(additionKey(a)).not.toBe(additionKey({ ...a, termUuid: 'b' }));
    expect(additionKey(a)).toBe(
      additionKey({ ...a, text: ' X ', occurrence: 1 }),
    );
  });
});
