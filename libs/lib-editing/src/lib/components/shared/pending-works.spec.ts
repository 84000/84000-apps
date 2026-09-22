import type { TaggedCommentEntry } from '@eightyfourthousand/client-graphql';
import type { Work } from '@eightyfourthousand/data-access';
import { pendingWorkRows } from './pending-works';

const tagged = (
  workUuid: string,
  content: string,
  createdAt: string,
): TaggedCommentEntry =>
  ({
    workUuid,
    passageUuids: [],
    comment: { uuid: content, content, createdAt },
  }) as unknown as TaggedCommentEntry;

const WORKS = [
  { uuid: 'w1', title: 'One', toh: ['toh1'] },
  { uuid: 'w2', title: 'Two', toh: ['toh2'] },
] as unknown as Work[];

describe('pendingWorkRows', () => {
  it('counts per work and keeps the newest comment as plain text', () => {
    const rows = pendingWorkRows(WORKS, [
      tagged('w1', '<p>older</p>', '2026-09-01T00:00:00Z'),
      tagged('w1', '<p>newer &amp; later</p>', '2026-09-03T00:00:00Z'),
      tagged('w2', '<p>other</p>', '2026-09-02T00:00:00Z'),
    ]);

    expect(
      rows.map(({ uuid, count, latest }) => [uuid, count, latest]),
    ).toEqual([
      ['w1', 2, 'newer & later'],
      ['w2', 1, 'other'],
    ]);
  });

  it('still lists a work it has no metadata for', () => {
    const [row] = pendingWorkRows(
      [],
      [tagged('w9', 'x', '2026-09-01T00:00:00Z')],
    );

    expect(row).toMatchObject({ uuid: 'w9', title: 'w9', count: 1 });
  });
});
