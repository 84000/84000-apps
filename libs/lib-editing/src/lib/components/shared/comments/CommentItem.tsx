'use client';

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
} from '@eightyfourthousand/design-system';
import type { CommentThread } from '@eightyfourthousand/data-access';
import { XIcon } from 'lucide-react';
import { useState } from 'react';
import { CommentComposer } from './CommentComposer';
import { relativeTime } from './relative-time';
import { CommentTagInput } from './CommentTagInput';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';

/**
 * One comment: who wrote it, when, its tags and the body — plus the actions its
 * author has over it. Any editor may tag it.
 */
export const CommentItem = ({
  comment,
  currentUserId,
  onEdit,
  onDelete,
  onSetTags,
}: {
  comment: CommentThread;
  /** Undefined until the session resolves, which hides the author actions. */
  currentUserId?: string;
  onEdit: (content: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onSetTags: (tags: string[]) => Promise<void>;
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
          {comment.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              data-comment-tag={tag}
              className="gap-0.5 px-1.5 py-0 text-[10px] font-medium"
            >
              {tag}
              <button
                type="button"
                aria-label={`Remove ${tag}`}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSetTags(comment.tags.filter((t) => t !== tag));
                }}
              >
                <XIcon className="size-2.5" />
              </button>
            </Badge>
          ))}
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
          // Rendered as markup: the body is a fragment sanitized on write.
          // `whitespace-pre-line` is for the bodies that are not — sanitizing
          // only ever removes, so a caller that sent bare text stored bare
          // text, and its newlines are all the paragraphs it has.
          <div
            className="text-xs break-words whitespace-pre-line mt-0.5 [&>p]:mb-1.5 [&>p:last-child]:mb-0"
            dangerouslySetInnerHTML={{ __html: comment.content }}
          />
        )}

        {!editing && (
          <div className="flex gap-1 -ms-2.5">
            <CommentTagInput
              tags={comment.tags}
              onAdd={(tag) => onSetTags([...comment.tags, tag])}
            />
            {isAuthor && (
              <>
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
                      {comment.replyCount > 0
                        ? 'Delete with replies'
                        : 'Confirm'}
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
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
