'use client';

import { cn } from '@eightyfourthousand/lib-utils';
import { Editor } from '@tiptap/core';
import { useEditorState } from '@tiptap/react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Separator,
  toast,
} from '@eightyfourthousand/design-system';
import {
  createGraphQLClient,
  createComment,
} from '@eightyfourthousand/client-graphql';
import {
  MessageSquarePlusIcon,
  Trash2Icon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useState } from 'react';
import { CommentComposer } from '../../../shared/comments';
import { useNavigation } from '../../../shared';
import { passageUuidForSelection } from '../../util';

/**
 * How long the popover needs to release focus before the document is mutated.
 * Radix restores focus to the trigger as it closes, which would take it back
 * from the editor and drop the selection the mark is applied to.
 */
const EDITOR_UPDATE_DELAY_MS = 50;

/**
 * Bubble-menu entry point for commenting on the selection.
 *
 * Studio only: `editable` is the application-level fact, so the sandbox editors
 * that mount this menu without a `NavigationProvider` get no button rather than
 * one that writes against an empty work.
 *
 * Commenting over an existing comment mark starts a new thread. Replies come
 * from the panel, where the thread they belong to is visible.
 */
export const CommentSelector = ({ editor }: { editor: Editor }) => {
  const [open, setOpen] = useState(false);
  const { editable, setFocusedComment, updatePanel, refreshComments } =
    useNavigation();

  const editorState = useEditorState({
    editor,
    selector: (instance) => ({
      isActive: instance.editor.isActive('comment'),
      activeComment: instance.editor.getAttributes('comment').comment as
        | string
        | undefined,
      hasSelection: !instance.editor.state.selection.empty,
    }),
  });

  const fail = (message: string) =>
    toast(message, {
      icon: <TriangleAlertIcon className="size-4 text-warning" />,
    });

  /**
   * Thread first, then the mark.
   *
   * A mark applied first would name a thread that does not exist yet, which the
   * panel cannot render and the user cannot remove. Failing the other way round
   * leaves a thread with no anchor, which the panel lists and the user can
   * delete.
   */
  const submit = async (content: string) => {
    const entityUuid = passageUuidForSelection(editor);
    if (!entityUuid) {
      fail('Could not tell which passage this is. Try again.');
      return;
    }

    // Captured before the write: the selection is what the mark is applied to,
    // and the await below gives the editor a chance to lose it.
    const { from, to } = editor.state.selection;

    // The composer disables itself for the duration of the await, so a slow
    // write cannot be submitted twice.
    let result;
    try {
      // Built here rather than on mount: the sandbox editors mount this menu
      // without the env the client reads, and they never reach this path.
      result = await createComment({
        client: createGraphQLClient(),
        entityUuid,
        entityType: 'passage',
        content,
      });
    } catch (error) {
      console.error('Error creating comment:', error);
      result = undefined;
    }

    if (!result?.success || !result.comment) {
      fail(
        result?.error ?? 'Could not start the comment. Nothing was changed.',
      );
      return;
    }

    const { uuid: comment } = result.comment;
    setOpen(false);

    setTimeout(() => {
      if (editor.isDestroyed) {
        return;
      }

      editor
        .chain()
        .focus()
        .setTextSelection({ from, to })
        .setComment({ comment })
        .setTextSelection(to)
        .run();

      // The panel reads from the server, so it needs telling; the anchor itself
      // only reaches the server with the next passage save.
      refreshComments();
      setFocusedComment(comment);
      updatePanel({
        name: 'left',
        state: { open: true, tab: 'comments', hash: comment },
      });
    }, EDITOR_UPDATE_DELAY_MS);
  };

  /**
   * Takes the highlight off the text and leaves the discussion alone — the two
   * are different intents, and a thread outlives its anchors by design. The
   * panel keeps listing it under Unanchored, where it stays replyable.
   */
  const removeHighlight = () => {
    const comment = editorState.activeComment;
    if (!comment) {
      return;
    }

    setOpen(false);
    setTimeout(() => {
      if (editor.isDestroyed) {
        return;
      }

      editor.chain().focus().unsetComment({ comment }).run();
      refreshComments();
    }, EDITOR_UPDATE_DELAY_MS);
  };

  if (!editable) {
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="px-2 rounded-none flex-shrink-0"
          aria-label="Comment on selection"
          disabled={!editorState.hasSelection}
        >
          <MessageSquarePlusIcon
            className={cn(
              'size-4',
              editorState.isActive
                ? 'text-foreground'
                : 'text-muted-foreground',
            )}
            strokeWidth={2.5}
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-72 shadow-xl rounded-md border p-2"
        align="end"
        noPortal
      >
        <CommentComposer
          placeholder="Add a comment…"
          submitLabel="Comment"
          autoFocus
          onSubmit={submit}
          onCancel={() => setOpen(false)}
        />
        {editorState.isActive && (
          <>
            <Separator className="my-2" />
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-sm"
              onClick={removeHighlight}
            >
              <Trash2Icon className="size-4 mr-1 text-destructive" />
              Remove highlight
            </Button>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};
