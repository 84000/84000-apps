'use client';

import {
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@eightyfourthousand/design-system';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { cn } from '@eightyfourthousand/lib-utils';
import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';
import { flattenThread } from './flatten-thread';

/** What the collapse control says, which is a count when there is one to give. */
const replyLabel = (count: number, open: boolean) => {
  if (open) return 'Hide replies';
  return `${count} ${count === 1 ? 'reply' : 'replies'}`;
};

/** What a thread card needs to do to a comment. Resolved by the panel. */
export interface CommentActions {
  reply: (parentUuid: string, content: string) => Promise<void>;
  edit: (uuid: string, content: string) => Promise<void>;
  remove: (uuid: string) => Promise<void>;
  resolve: (uuid: string, resolved: boolean) => Promise<void>;
  setTags: (uuid: string, tags: string[]) => Promise<void>;
  /** Fetches the replies below a comment a shallower read stopped at. */
  expand: (uuid: string) => Promise<void>;
}

/**
 * One thread in the panel: a conversation about one span of text, its replies
 * in the order they were written, and the actions over it.
 *
 * One level deep, whatever the data holds. Comments nest without limit, but a
 * thread here discusses one passage rather than branching like a forum: the
 * replies are indented once, under the comment that opened it, and read in the
 * order they were written. Replies written at any depth still appear, in their
 * place in the conversation.
 *
 * Collapses to the comment that opened it, which is the one naming the problem;
 * the panel reads as a margin, and a long discussion of one phrase should not
 * push the next passage's off the screen.
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
  const [open, setOpen] = useState(true);
  const [replying, setReplying] = useState(false);
  const [expanding, setExpanding] = useState(false);
  const { entries, replyTo, truncated } = flattenThread(thread);
  const [opening, ...replies] = entries;
  const resolved = !!thread.resolvedAt;
  const hidden = truncated.reduce(
    (total, comment) => total + comment.replyCount - comment.replies.length,
    0,
  );

  return (
    <div
      data-comment-thread={thread.uuid}
      className={cn(
        'rounded border p-2 cursor-pointer',
        selected ? 'border-secondary bg-secondary/5' : 'border-border',
        resolved && 'opacity-70',
      )}
      onMouseEnter={() => onHover(thread.uuid)}
      onMouseLeave={() => onHover(undefined)}
      onClick={() => onSelect(thread.uuid)}
    >
      <CommentItem
        comment={opening}
        currentUserId={currentUserId}
        onEdit={(content) => actions.edit(opening.uuid, content)}
        onDelete={() => actions.remove(opening.uuid)}
        onSetTags={(tags) => actions.setTags(opening.uuid, tags)}
      />

      <Collapsible open={open} onOpenChange={setOpen}>
        {/* A thread with nothing under it has nothing to collapse, so it gets
            no control — only the reply box, which is always reachable. */}
        {(replies.length > 0 || hidden > 0) && (
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="group/collapsible flex items-center gap-1 text-[11px] text-muted-foreground cursor-pointer mt-1"
              onClick={(e) => e.stopPropagation()}
            >
              <ChevronRightIcon className="size-3 shrink-0 transition-transform group-data-[state=open]/collapsible:rotate-90" />
              {replyLabel(replies.length + hidden, open)}
            </button>
          </CollapsibleTrigger>
        )}

        <CollapsibleContent>
          {/* One step of indent for the replies and no more, whatever depth
              they were written at: it separates the answers from the question
              without turning a discussion of one passage into a tree. */}
          {replies.length > 0 && (
            <div className="mt-2 ps-2 border-s border-border flex flex-col gap-2">
              {replies.map((comment) => (
                <CommentItem
                  key={comment.uuid}
                  comment={comment}
                  currentUserId={currentUserId}
                  onEdit={(content) => actions.edit(comment.uuid, content)}
                  onDelete={() => actions.remove(comment.uuid)}
                  onSetTags={(tags) => actions.setTags(comment.uuid, tags)}
                />
              ))}
            </div>
          )}

          {hidden > 0 && (
            <Button
              size="xs"
              variant="ghost"
              className="mt-1 text-[11px] text-muted-foreground"
              disabled={expanding}
              onClick={async (e) => {
                e.stopPropagation();
                setExpanding(true);
                try {
                  // The shallowest one first: a read from there goes ten levels
                  // down, so it usually brings the rest with it.
                  await actions.expand(truncated[0].uuid);
                } finally {
                  setExpanding(false);
                }
              }}
            >
              {`Show ${hidden} more ${hidden === 1 ? 'reply' : 'replies'}`}
            </Button>
          )}

          {replying ? (
            <div onClick={(e) => e.stopPropagation()}>
              <CommentComposer
                autoFocus
                onCancel={() => setReplying(false)}
                onSubmit={async (content) => {
                  await actions.reply(replyTo.uuid, content);
                  setReplying(false);
                }}
              />
            </div>
          ) : (
            <Button
              size="xs"
              variant="ghost"
              className="mt-1 text-[11px] text-muted-foreground"
              onClick={(e) => {
                e.stopPropagation();
                setReplying(true);
              }}
            >
              Reply
            </Button>
          )}
        </CollapsibleContent>
      </Collapsible>

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
