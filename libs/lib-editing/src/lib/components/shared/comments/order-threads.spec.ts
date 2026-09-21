import type { PassageComments } from '@eightyfourthousand/client-graphql';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { orderThreads } from './order-threads';

const thread = (uuid: string, createdAt = '2026-09-01T00:00:00Z') =>
  ({
    uuid,
    content: uuid,
    author: { id: 'u1', displayName: 'Editor' },
    createdAt,
    updatedAt: createdAt,
    replies: [],
    replyCount: 0,
  }) as CommentThread;

const anchor = (passageUuid: string, start: number, uuid = `a-${start}`) => ({
  uuid,
  passageUuid,
  start,
  end: start + 5,
});

const passage = ({
  uuid,
  sort,
  label = uuid,
  type = 'translation',
  anchored = [],
  unanchored = [],
}: {
  uuid: string;
  sort: number;
  label?: string;
  type?: string;
  anchored?: PassageComments['anchored'];
  unanchored?: PassageComments['unanchored'];
}): PassageComments => ({
  passageUuid: uuid,
  label,
  type,
  sort,
  anchored,
  unanchored,
});

describe('orderThreads', () => {
  it('orders by position rather than by when the comment was written', () => {
    const later = thread('later', '2026-09-10T00:00:00Z');
    const earlier = thread('earlier', '2026-09-01T00:00:00Z');

    const { anchored } = orderThreads([
      passage({
        uuid: 'p1',
        sort: 1,
        anchored: [
          { thread: earlier, anchors: [anchor('p1', 90)] },
          { thread: later, anchors: [anchor('p1', 10)] },
        ],
      }),
    ]);

    expect(anchored.map(({ thread }) => thread.uuid)).toEqual([
      'later',
      'earlier',
    ]);
  });

  it('follows the work order across passages', () => {
    const { anchored } = orderThreads([
      passage({
        uuid: 'p2',
        sort: 2,
        anchored: [{ thread: thread('second'), anchors: [anchor('p2', 0)] }],
      }),
      passage({
        uuid: 'p1',
        sort: 1,
        anchored: [{ thread: thread('first'), anchors: [anchor('p1', 99)] }],
      }),
    ]);

    expect(anchored.map(({ thread }) => thread.uuid)).toEqual([
      'first',
      'second',
    ]);
  });

  it('lists a thread once however many anchors carry it, collecting them all', () => {
    // A selection crossing a passage boundary is one row per passage, so the
    // same thread comes back under both.
    const crossing = thread('crossing');

    const { anchored } = orderThreads([
      passage({
        uuid: 'p1',
        sort: 1,
        anchored: [{ thread: crossing, anchors: [anchor('p1', 80)] }],
      }),
      passage({
        uuid: 'p2',
        sort: 2,
        anchored: [{ thread: crossing, anchors: [anchor('p2', 0)] }],
      }),
    ]);

    expect(anchored).toHaveLength(1);
    expect(anchored[0].anchors.map((a) => a.passageUuid)).toEqual(['p1', 'p2']);
    // Position is the first anchor, so the thread sits with the passage it opens on.
    expect(anchored[0].passageLabel).toBe('p1');
  });

  it('keeps a thread with no anchor in its own list', () => {
    const { anchored, unanchored } = orderThreads([
      passage({ uuid: 'p1', sort: 1, unanchored: [thread('orphan')] }),
    ]);

    expect(anchored).toEqual([]);
    expect(unanchored.map(({ thread }) => thread.uuid)).toEqual(['orphan']);
    expect(unanchored[0].anchors).toEqual([]);
  });

  it('does not call a thread unanchored when another passage anchors it', () => {
    // Scope is per passage: a thread born on p1 whose anchor moved to p2 comes
    // back unanchored from p1 and anchored from p2. It is anchored.
    const moved = thread('moved');

    const { anchored, unanchored } = orderThreads([
      passage({ uuid: 'p1', sort: 1, unanchored: [moved] }),
      passage({
        uuid: 'p2',
        sort: 2,
        anchored: [{ thread: moved, anchors: [anchor('p2', 4)] }],
      }),
    ]);

    expect(unanchored).toEqual([]);
    expect(anchored.map(({ thread }) => thread.uuid)).toEqual(['moved']);
  });

  it('orders unanchored threads oldest first, since they have no position', () => {
    const { unanchored } = orderThreads([
      passage({
        uuid: 'p1',
        sort: 1,
        unanchored: [
          thread('newer', '2026-09-10T00:00:00Z'),
          thread('older', '2026-09-01T00:00:00Z'),
        ],
      }),
    ]);

    expect(unanchored.map(({ thread }) => thread.uuid)).toEqual([
      'older',
      'newer',
    ]);
  });
});
