'use client';

import { Button } from '@eightyfourthousand/design-system';
import type {
  CommentThread,
  CommentThreads,
} from '@eightyfourthousand/data-access';
import { cn } from '@eightyfourthousand/lib-utils';
import { useState } from 'react';
import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';

/** What a thread card needs to do to a comment. Resolved by the panel. */
export interface CommentActions {
  reply: (parentUuid: string, content: string) => Promise<void>;
  edit: (uuid: string, content: string) => Promise<void>;
  remove: (uuid: string) => Promise<void>;
  resolve: (uuid: string, resolved: boolean) => Promise<void>;
  /** Fetches the replies below a comment a shallower read stopped at. */
  expand: (uuid: string) => Promise<void>;
}

/**
 * Replies under a comment, nested.
 *
 * Recursive because threads are not depth-limited in the data — only in any one
 * response, which is what `replyCount` against the replies carried reveals.
 */
const CommentReplies = ({
  replies,
  currentUserId,
  actions,
}: {
  replies: CommentThreads;
  currentUserId?: string;
  actions: CommentActions;
}) => (
  <>
    {replies.map((reply) => (
      <div key={reply.uuid} className="mt-2 ps-2 border-s border-border">
        <CommentBranch
          comment={reply}
          currentUserId={currentUserId}
          actions={actions}
        />
      </div>
    ))}
  </>
);

const CommentBranch = ({
  comment,
  currentUserId,
  actions,
}: {
  comment: CommentThread;
  currentUserId?: string;
  actions: CommentActions;
}) => {
  const [replying, setReplying] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const hidden = comment.replyCount - comment.replies.length;

  return (
    <CommentItem
      comment={comment}
      currentUserId={currentUserId}
      onEdit={(content) => actions.edit(comment.uuid, content)}
      onDelete={() => actions.remove(comment.uuid)}
    >
      <CommentReplies
        replies={comment.replies}
        currentUserId={currentUserId}
        actions={actions}
      />

      {hidden > 0 && (
        <Button
          size="xs"
          variant="ghost"
          className="text-[11px] text-muted-foreground -ms-2.5"
          disabled={expanding}
          onClick={async () => {
            setExpanding(true);
            try {
              await actions.expand(comment.uuid);
            } finally {
              setExpanding(false);
            }
          }}
        >
          {`Show ${hidden} more ${hidden === 1 ? 'reply' : 'replies'}`}
        </Button>
      )}

      {replying ? (
        <CommentComposer
          autoFocus
          onCancel={() => setReplying(false)}
          onSubmit={async (content) => {
            await actions.reply(comment.uuid, content);
            setReplying(false);
          }}
        />
      ) : (
        <Button
          size="xs"
          variant="ghost"
          className="text-[11px] text-muted-foreground -ms-2.5"
          onClick={() => setReplying(true)}
        >
          Reply
        </Button>
      )}
    </CommentItem>
  );
};

/**
 * One thread in the panel: its root, its replies, and the actions over it.
 *
 * Hovering or selecting it highlights every range it is anchored to — the
 * panel owns that, since a thread's anchors may sit on several passages.
 */
export const CommentThreadCard = ({
  thread,
  currentUserId,
  selected,
  anchorCount = 0,
  actions,
  onHover,
  onSelect,
}: {
  thread: CommentThread;
  currentUserId?: string;
  selected?: boolean;
  /** How many places in the text point at this thread. Zero when unanchored. */
  anchorCount?: number;
  actions: CommentActions;
  onHover: (uuid?: string) => void;
  onSelect: (uuid: string) => void;
}) => {
  const resolved = !!thread.resolvedAt;

  return (
    <div
      data-comment-thread={thread.uuid}
      className={cn(
        'rounded border p-2 cursor-pointer',
        selected ? 'border-accent bg-accent/5' : 'border-border',
        resolved && 'opacity-70',
      )}
      onMouseEnter={() => onHover(thread.uuid)}
      onMouseLeave={() => onHover(undefined)}
      onClick={() => onSelect(thread.uuid)}
    >
      <CommentBranch
        comment={thread}
        currentUserId={currentUserId}
        actions={actions}
      />

      <div className="flex items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-border">
        <span className="text-[11px] text-muted-foreground">
          {anchorCount > 1 && `${anchorCount} places`}
          {resolved &&
            thread.resolvedBy &&
            `${anchorCount > 1 ? ' · ' : ''}Resolved by ${thread.resolvedBy.displayName}`}
        </span>
        <Button
          size="xs"
          variant="ghost"
          className="text-[11px] text-muted-foreground"
          onClick={(e) => {
            e.stopPropagation();
            actions.resolve(thread.uuid, !resolved);
          }}
        >
          {resolved ? 'Unresolve' : 'Resolve'}
        </Button>
      </div>
    </div>
  );
};
