import type { Work } from '@eightyfourthousand/data-access';
import { pendingWorkRows } from './pending-works';

const WORKS = [
  { uuid: 'w1', title: 'One', toh: ['toh1'] },
  { uuid: 'w2', title: 'Two', toh: ['toh2'] },
] as unknown as Work[];

describe('pendingWorkRows', () => {
  it('keeps the server order and carries each count', () => {
    const rows = pendingWorkRows(WORKS, [
      { workUuid: 'w2', count: 1, latestAt: '2026-09-03T00:00:00Z' },
      { workUuid: 'w1', count: 2, latestAt: '2026-09-01T00:00:00Z' },
    ]);

    expect(rows.map(({ uuid, title, count }) => [uuid, title, count])).toEqual([
      ['w2', 'Two', 1],
      ['w1', 'One', 2],
    ]);
  });

  it('still lists a work it has no metadata for', () => {
    const [row] = pendingWorkRows(
      [],
      [{ workUuid: 'w9', count: 1, latestAt: '2026-09-01T00:00:00Z' }],
    );

    expect(row).toMatchObject({ uuid: 'w9', title: 'w9', count: 1 });
  });
});
