import {
  dedupeRequests,
  parseWorkList,
  partitionBySince,
  runBatch,
  type WorkRequest,
} from './batch';

describe('parseWorkList', () => {
  it('accepts a plain list of works', () => {
    expect(parseWorkList('["toh1", "toh2"]')).toEqual([
      { work: 'toh1' },
      { work: 'toh2' },
    ]);
  });

  it('accepts objects carrying a per-work version and notes', () => {
    expect(
      parseWorkList('[{"work":"toh1","version":"1.1.0","notes":"why"}]'),
    ).toEqual([{ work: 'toh1', version: '1.1.0', notes: 'why' }]);
  });

  it('accepts a mixed list', () => {
    expect(parseWorkList('["toh1", {"work":"toh2"}]')).toEqual([
      { work: 'toh1' },
      { work: 'toh2' },
    ]);
  });

  it('rejects a payload that is not an array', () => {
    expect(() => parseWorkList('{"work":"toh1"}')).toThrow(/JSON array/);
  });

  it('names the offending index when an entry is unusable', () => {
    expect(() => parseWorkList('["toh1", {"version":"1.0.0"}]')).toThrow(
      /Entry 1/,
    );
  });
});

describe('dedupeRequests', () => {
  it('keeps the first occurrence and its settings', () => {
    expect(
      dedupeRequests([
        { work: 'toh1', notes: 'first' },
        { work: 'toh1', notes: 'second' },
        { work: 'toh2' },
      ]),
    ).toEqual([{ work: 'toh1', notes: 'first' }, { work: 'toh2' }]);
  });

  // --all-published plus an explicitly named work is a plausible way to ask for a run, and
  // publishing the same work twice in one pass would create two versions of it.
  it('collapses a work named twice', () => {
    expect(dedupeRequests([{ work: 'toh1' }, { work: 'toh1' }])).toHaveLength(
      1,
    );
  });
});

describe('partitionBySince', () => {
  const since = new Date('2026-08-17T12:00:00Z');

  it('skips a work published after the cutoff', () => {
    const { todo, skipped } = partitionBySince({
      requests: [{ work: 'toh1' }],
      published: [
        { uuid: 'u1', toh: 'toh1', publishedAt: '2026-08-17T13:00:00Z' },
      ],
      since,
    });
    expect(todo).toEqual([]);
    expect(skipped).toEqual([{ work: 'toh1' }]);
  });

  it('keeps a work published before the cutoff', () => {
    const { todo, skipped } = partitionBySince({
      requests: [{ work: 'toh1' }],
      published: [
        { uuid: 'u1', toh: 'toh1', publishedAt: '2026-08-11T21:40:00Z' },
      ],
      since,
    });
    expect(todo).toEqual([{ work: 'toh1' }]);
    expect(skipped).toEqual([]);
  });

  // The cutoff is the run's start instant, so a work published exactly then was published
  // by this run.
  it('treats a publish exactly at the cutoff as done', () => {
    const { skipped } = partitionBySince({
      requests: [{ work: 'toh1' }],
      published: [
        { uuid: 'u1', toh: 'toh1', publishedAt: '2026-08-17T12:00:00Z' },
      ],
      since,
    });
    expect(skipped).toHaveLength(1);
  });

  it('matches by uuid as well as toh', () => {
    const { skipped } = partitionBySince({
      requests: [{ work: 'u1' }],
      published: [
        { uuid: 'u1', toh: 'toh1', publishedAt: '2026-08-17T13:00:00Z' },
      ],
      since,
    });
    expect(skipped).toEqual([{ work: 'u1' }]);
  });

  it('keeps a work that has never been published', () => {
    const { todo } = partitionBySince({
      requests: [{ work: 'toh9' }],
      published: [
        { uuid: 'u1', toh: 'toh1', publishedAt: '2026-08-17T13:00:00Z' },
      ],
      since,
    });
    expect(todo).toEqual([{ work: 'toh9' }]);
  });

  // A work whose pointer exists but whose version row has gone missing has no timestamp to
  // compare, so it must not be assumed done.
  it('keeps a work with no published timestamp', () => {
    const { todo } = partitionBySince({
      requests: [{ work: 'toh1' }],
      published: [{ uuid: 'u1', toh: 'toh1', publishedAt: null }],
      since,
    });
    expect(todo).toEqual([{ work: 'toh1' }]);
  });
});

describe('runBatch', () => {
  const requests: WorkRequest[] = [
    { work: 'toh1' },
    { work: 'toh2' },
    { work: 'toh3' },
  ];

  it('runs every request even when one fails', async () => {
    const seen: string[] = [];
    const summary = await runBatch({
      requests,
      each: async (request) => {
        seen.push(request.work);
        return request.work === 'toh2'
          ? { ok: false, message: 'toh2: nope' }
          : { ok: true, message: `${request.work}: done` };
      },
    });

    expect(seen).toEqual(['toh1', 'toh2', 'toh3']);
    expect(summary.succeeded).toEqual(['toh1', 'toh3']);
    expect(summary.failed).toEqual([{ work: 'toh2', message: 'toh2: nope' }]);
  });

  // A throw is a failed work, not a failed run: the remaining works are independent.
  it('records a thrown error and keeps going', async () => {
    const summary = await runBatch({
      requests,
      each: async (request) => {
        if (request.work === 'toh1') throw new Error('exploded');
        return { ok: true, message: 'done' };
      },
    });

    expect(summary.succeeded).toEqual(['toh2', 'toh3']);
    expect(summary.failed).toEqual([
      { work: 'toh1', message: 'toh1: exploded' },
    ]);
  });

  it('runs sequentially', async () => {
    const order: string[] = [];
    await runBatch({
      requests,
      each: async (request) => {
        order.push(`start:${request.work}`);
        await Promise.resolve();
        order.push(`end:${request.work}`);
        return { ok: true, message: 'done' };
      },
    });

    expect(order).toEqual([
      'start:toh1',
      'end:toh1',
      'start:toh2',
      'end:toh2',
      'start:toh3',
      'end:toh3',
    ]);
  });

  it('reports progress with position and total', async () => {
    const labels: string[] = [];
    await runBatch({
      requests,
      each: async () => ({ ok: true, message: 'done' }),
      onStart: (request, index, total) =>
        labels.push(`${index + 1}/${total} ${request.work}`),
    });

    expect(labels).toEqual(['1/3 toh1', '2/3 toh2', '3/3 toh3']);
  });
});
