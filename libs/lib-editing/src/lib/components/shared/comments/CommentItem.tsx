'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
} from '@eightyfourthousand/design-system';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { useState } from 'react';
import { CommentComposer } from './CommentComposer';
import { relativeTime } from './relative-time';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

/**
 * One comment: who wrote it, when, and the body — plus the actions its author
 * has over it.
 */
export const CommentItem = ({
  comment,
  currentUserId,
  onEdit,
  onDelete,
}: {
  comment: CommentThread;
  /** Undefined until the session resolves, which hides the author actions. */
  currentUserId?: string;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
}) => {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const isAuthor = !!currentUserId && comment.author.id === currentUserId;
  const edited = comment.updatedAt !== comment.createdAt;

  return (
    <div className="flex gap-2">
      <Avatar className="size-6 mt-0.5 shrink-0">
        {comment.author.avatarUrl && (
          <AvatarImage src={comment.author.avatarUrl} alt="" />
        )}
        <AvatarFallback className="text-[10px]">
          {initials(comment.author.displayName)}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-xs font-medium">
            {comment.author.displayName}
          </span>
          <span className="text-[11px] text-muted-foreground">
            {relativeTime(comment.createdAt)}
            {edited && ' · edited'}
          </span>
        </div>

        {editing ? (
          <CommentComposer
            initialValue={comment.content}
            submitLabel="Save"
            autoFocus
            onCancel={() => setEditing(false)}
            onSubmit={async (content) => {
              await onEdit(content);
              setEditing(false);
            }}
          />
        ) : (
          <p className="text-xs whitespace-pre-wrap break-words mt-0.5">
            {comment.content}
          </p>
        )}

        {isAuthor && !editing && (
          <div className="flex gap-1 -ms-2.5">
            <Button
              size="xs"
              variant="ghost"
              className="text-[11px] text-muted-foreground"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
            {confirmingDelete ? (
              <>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-[11px] text-destructive"
                  onClick={async () => {
                    setConfirmingDelete(false);
                    await onDelete();
                  }}
                >
                  {/* A delete cascades to everything filed under this
                      comment, other people's replies included, so the
                      confirmation says so rather than just 'Confirm'. */}
                  {comment.replyCount > 0 ? 'Delete with replies' : 'Confirm'}
                </Button>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-[11px] text-muted-foreground"
                  onClick={() => setConfirmingDelete(false)}
                >
                  Cancel
                </Button>
              </>
            ) : (
              <Button
                size="xs"
                variant="ghost"
                className="text-[11px] text-muted-foreground"
                onClick={() => setConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
