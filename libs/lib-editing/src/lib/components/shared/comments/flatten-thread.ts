import type { CommentThread } from '@eightyfourthousand/data-access';

/** A thread's comments in the order they were written, root first. */
export interface FlatThread {
  /** The root, then every descendant in the order it was written. Never empty. */
  entries: CommentThread[];
  /**
   * What a new reply hangs off: the root, so every reply is its sibling.
   *
   * The panel draws no nesting, so this is invisible either way — but chaining
   * each reply onto the one before it would make an ordinary conversation as
   * deep as it is long, and a read nests two levels by default. A fourth
   * message would arrive truncated on every load.
   */
  replyTo: CommentThread;
  /**
   * Comments holding back replies this read did not carry, deepest last. A
   * thread with any of these is showing less than it has.
   */
  truncated: CommentThread[];
}

/**
 * Lays a thread out as a conversation rather than a tree.
 *
 * The data nests without limit and a read may return any shape, but nesting is
 * not what a comment thread is for here — it is a conversation about one span
 * of text. Flattening keeps every comment visible whatever shape it arrived
 * in, including replies written before the panel stopped offering to branch.
 */
export const flattenThread = (root: CommentThread): FlatThread => {
  const replies: CommentThread[] = [];
  const truncated: CommentThread[] = [];

  // A cycle is storable: `parent_uuid` permits one, and following it blindly
  // would spin rather than return a short answer.
  const seen = new Set<string>();

  const walk = (comment: CommentThread) => {
    if (seen.has(comment.uuid)) return;
    seen.add(comment.uuid);

    if (comment !== root) replies.push(comment);
    if (comment.replyCount > comment.replies.length) {
      truncated.push(comment);
    }

    comment.replies.forEach(walk);
  };

  walk(root);

  // By time, not by where each reply sits in the tree. Grouping a reply with
  // its parent is what the indent used to say; without the indent it only
  // reads as the conversation happening out of order.
  replies.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return { entries: [root, ...replies], replyTo: root, truncated };
};
