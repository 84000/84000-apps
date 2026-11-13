'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createComment,
  createGraphQLClient,
  getGlossaryComments,
} from '@eightyfourthousand/client-graphql';
import { englishNameOf } from '@eightyfourthousand/data-access';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DropdownMenuItem,
  toast,
} from '@eightyfourthousand/design-system';
import {
  MessageSquareIcon,
  MessageSquarePlusIcon,
  TriangleAlertIcon,
} from 'lucide-react';

import { CommentComposer } from '../shared/comments';
import { useNavigation } from '../shared/NavigationContext';
import type { StackController } from './StackController';

/** The entry a comment is being written on. */
type Adding = { uuid: string; title: string };

/**
 * Which glossary entries of a work have comment threads, and the actions on
 * them. Read once for the work, and again when a comment is written, rather
 * than for each row or each time a menu opens. Does nothing outside the studio.
 */
export const useGlossaryRowComments = (workUuid?: string) => {
  const {
    editable,
    commentsRevision,
    refreshComments,
    setFocusedComment,
    updatePanel,
  } = useNavigation();
  const [threads, setThreads] = useState<Map<string, string>>(new Map());
  const [adding, setAdding] = useState<Adding | null>(null);

  useEffect(() => {
    if (!editable || !workUuid) return;
    let current = true;
    getGlossaryComments({ client: createGraphQLClient(), workUuid }).then(
      (entries) => {
        if (!current) return;
        setThreads(
          new Map(
            entries.flatMap(({ passageUuid, anchored }) =>
              anchored[0] ? [[passageUuid, anchored[0].thread.uuid]] : [],
            ),
          ),
        );
      },
    );
    return () => {
      current = false;
    };
  }, [editable, workUuid, commentsRevision]);

  const show = useCallback(
    (thread: string) => {
      setFocusedComment(thread);
      updatePanel({
        name: 'left',
        state: { open: true, tab: 'comments', hash: thread },
      });
    },
    [setFocusedComment, updatePanel],
  );

  return useMemo(
    () => ({
      editable,
      threads,
      adding,
      startAdding: setAdding,
      stopAdding: () => setAdding(null),
      show,
      refreshComments,
    }),
    [editable, threads, adding, show, refreshComments],
  );
};

export type GlossaryRowComments = ReturnType<typeof useGlossaryRowComments>;

/** An entry's label and English name, such as "g.4 Indra". */
const titleOf = (controller: StackController, uuid: string) => {
  const entry = controller.getGlossaryEntry(uuid);
  const name = entry && englishNameOf(entry)?.content;
  return [controller.getMeta(uuid)?.label, name].filter(Boolean).join(' ');
};

/**
 * The label menu's comment entry: "See comments" when the entry has a thread,
 * which opens it in the comments panel, else "Add comment".
 */
export const GlossaryCommentMenuItem = ({
  comments,
  controller,
  uuid,
  onClose,
}: {
  comments: GlossaryRowComments;
  controller: StackController;
  uuid: string;
  onClose: () => void;
}) => {
  if (!comments.editable) return null;
  const thread = comments.threads.get(uuid);

  return (
    <DropdownMenuItem
      onSelect={() => {
        if (thread) {
          comments.show(thread);
        } else {
          comments.startAdding({ uuid, title: titleOf(controller, uuid) });
        }
        onClose();
      }}
    >
      {thread ? (
        <MessageSquareIcon className="text-primary" />
      ) : (
        <MessageSquarePlusIcon className="text-primary" />
      )}
      {thread ? 'See comments' : 'Add comment'}
    </DropdownMenuItem>
  );
};

/** Starts a thread on an entry, then shows it in the comments panel. */
export const GlossaryCommentDialog = ({
  comments,
}: {
  comments: GlossaryRowComments;
}) => {
  const { adding, stopAdding, show, refreshComments } = comments;

  const submit = async (content: string) => {
    if (!adding) return;
    let result;
    try {
      result = await createComment({
        client: createGraphQLClient(),
        entityUuid: adding.uuid,
        entityType: 'glossary',
        content,
      });
    } catch (error) {
      console.error('Error creating comment:', error);
    }

    if (!result?.success || !result.comment) {
      toast(
        result?.error ?? 'Could not start the comment. Nothing was changed.',
        { icon: <TriangleAlertIcon className="size-4 text-warning" /> },
      );
      return;
    }

    stopAdding();
    refreshComments();
    show(result.comment.uuid);
  };

  return (
    <Dialog open={!!adding} onOpenChange={(open) => !open && stopAdding()}>
      {adding && (
        <DialogContent className="max-w-readable">
          <DialogHeader>
            <DialogTitle>Comment on {adding.title}</DialogTitle>
            <DialogDescription>
              Starts a thread on this entry, shown in the comments panel.
            </DialogDescription>
          </DialogHeader>
          <CommentComposer
            placeholder="Add a comment…"
            submitLabel="Comment"
            autoFocus
            onSubmit={submit}
            onCancel={stopAdding}
          />
        </DialogContent>
      )}
    </Dialog>
  );
};
