'use client';

import { useState } from 'react';
import {
  createComment,
  createGraphQLClient,
} from '@eightyfourthousand/client-graphql';
import { Button, toast } from '@eightyfourthousand/design-system';
import { TriangleAlertIcon } from 'lucide-react';

import { CommentComposer } from '../shared/comments';
import { useNavigation } from '../shared/NavigationContext';

/**
 * "Comment" under a glossary entry: starts a thread on the entry, then shows
 * it in the comments panel. Draws nothing where a reader sees the work.
 */
export const GlossaryRowComment = ({ uuid }: { uuid: string }) => {
  const { editable, refreshComments, setFocusedComment, updatePanel } =
    useNavigation();
  const [open, setOpen] = useState(false);

  if (!editable) return null;

  const submit = async (content: string) => {
    let result;
    try {
      result = await createComment({
        client: createGraphQLClient(),
        entityUuid: uuid,
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

    const { uuid: comment } = result.comment;
    setOpen(false);
    refreshComments();
    setFocusedComment(comment);
    updatePanel({
      name: 'left',
      state: { open: true, tab: 'comments', hash: comment },
    });
  };

  return (
    <div className="flex flex-col" data-glossary-comment="">
      <Button
        variant="link"
        className="h-auto p-0 self-start text-sm font-normal hover:cursor-pointer"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        Comment
      </Button>
      {open && (
        <div className="max-w-md">
          <CommentComposer
            placeholder="Add a comment…"
            submitLabel="Comment"
            autoFocus
            onSubmit={submit}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
};
