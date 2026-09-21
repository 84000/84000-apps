import type { CommentThread } from '@eightyfourthousand/data-access';
import { flattenThread } from './flatten-thread';

const comment = (
  uuid: string,
  createdAt: string,
  replies: CommentThread[] = [],
  replyCount?: number,
): CommentThread => ({
  uuid,
  content: uuid,
  author: { id: 'u1', displayName: 'Editor' },
  createdAt,
  updatedAt: createdAt,
  replies,
  replyCount: replyCount ?? replies.length,
});

describe('flattenThread', () => {
  it('lays a nested thread out as one conversation', () => {
    // Nesting is in the data, not on screen. A reply written under an earlier,
    // branching UI still has to appear.
    const root = comment('root', '2026-09-01T00:00:00Z', [
      comment('r1', '2026-09-02T00:00:00Z', [
        comment('r2', '2026-09-03T00:00:00Z'),
      ]),
    ]);

    expect(flattenThread(root).entries.map((c) => c.uuid)).toEqual([
      'root',
      'r1',
      'r2',
    ]);
  });

  it('orders replies by when they were written, not by where they sit', () => {
    // Without the indent, grouping a reply with its parent only reads as the
    // conversation happening out of order.
    const root = comment('root', '2026-09-01T00:00:00Z', [
      comment('early-branch', '2026-09-02T00:00:00Z', [
        comment('newest', '2026-09-09T00:00:00Z'),
      ]),
      comment('middle', '2026-09-05T00:00:00Z'),
    ]);

    expect(flattenThread(root).entries.map((c) => c.uuid)).toEqual([
      'root',
      'early-branch',
      'middle',
      'newest',
    ]);
  });

  it('hangs a new reply off the root, not the last entry', () => {
    // Invisible either way, since nothing is indented — but chaining would make
    // a conversation as deep as it is long, and a read nests two levels.
    const root = comment('root', '2026-09-01T00:00:00Z', [
      comment('r1', '2026-09-02T00:00:00Z'),
      comment('r2', '2026-09-03T00:00:00Z'),
    ]);

    expect(flattenThread(root).replyTo.uuid).toBe('root');
  });

  it('answers with the root alone when there are no replies', () => {
    const root = comment('root', '2026-09-01T00:00:00Z');
    const flat = flattenThread(root);

    expect(flat.entries.map((c) => c.uuid)).toEqual(['root']);
    expect(flat.replyTo.uuid).toBe('root');
    expect(flat.truncated).toEqual([]);
  });

  it('reports the comments whose replies the read stopped short of', () => {
    const root = comment(
      'root',
      '2026-09-01T00:00:00Z',
      [comment('r1', '2026-09-02T00:00:00Z', [], 4)],
      1,
    );

    expect(flattenThread(root).truncated.map((c) => c.uuid)).toEqual(['r1']);
  });

  it('does not spin on a parent cycle', () => {
    // `comments.parent_uuid` permits one, and a read can carry it through.
    const root = comment('root', '2026-09-01T00:00:00Z');
    const child = comment('child', '2026-09-02T00:00:00Z', [root]);
    root.replies = [child];

    expect(flattenThread(root).entries.map((c) => c.uuid)).toEqual([
      'root',
      'child',
    ]);
  });
});
