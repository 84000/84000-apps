'use client';

import {
  createGraphQLClient,
  deleteComment,
  getCommentThread,
  getPassageComments,
  replyToComment,
  resolveComment,
  updateComment,
  type PassageComments,
} from '@eightyfourthousand/client-graphql';
import {
  createBrowserClient,
  getSession,
  type CommentThread,
} from '@eightyfourthousand/data-access';
import { Button } from '@eightyfourthousand/design-system';
import type { Editor } from '@tiptap/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getEditorForElement } from '../../editor/util';
import { useNavigation } from '../NavigationProvider';
import { locationForPassageType } from '../types';
import { CommentThreadCard, type CommentActions } from './CommentThreadCard';
import { orderThreads, type PanelThread } from './order-threads';
import { anchorSelector, attributeValue } from './selectors';
import { useCommentAnchorStyles } from './useCommentAnchorStyles';
import { useVisiblePassageUuids } from './useVisiblePassageUuids';

/**
 * Comment threads for the passages on screen, beside the text they annotate.
 *
 * Editor-only. Comments are draft-only working material and never reach a
 * published version, so a reader has nothing to read here.
 *
 * Passages are what a thread hangs off today; the store was shaped for glossary
 * entries and bibliographies too, so this reads a set of entities rather than
 * the body specifically.
 */
export const CommentsPanel = ({ workUuid }: { workUuid: string }) => {
  const {
    commentsRevision,
    focusedComment,
    requestEditorFor,
    setFocusedComment,
    updatePanel,
  } = useNavigation();
  const passageUuids = useVisiblePassageUuids();
  const [passages, setPassages] = useState<PassageComments[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>();
  const [hovered, setHovered] = useState<string>();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const session = await getSession({ client: createBrowserClient() });
      setCurrentUserId(session?.user?.id);
    })();
  }, []);

  const client = useMemo(() => createGraphQLClient(), []);
  const [readCount, setReadCount] = useState(0);

  /** Re-reads the panel. Every write goes through it, so a change shows at once. */
  const reload = useCallback(() => setReadCount((count) => count + 1), []);

  useEffect(() => {
    // Scrolling changes the passage set while a read is in flight, and the
    // responses need not come back in order.
    let current = true;

    (async () => {
      const read = await getPassageComments({
        client,
        workUuid,
        passageUuids,
      });
      if (!current) return;
      setPassages(read);
      setLoading(false);
    })();

    return () => {
      current = false;
    };
  }, [client, workUuid, passageUuids, readCount, commentsRevision]);

  const { anchored, unanchored } = useMemo(() => {
    const ordered = orderThreads(passages);

    if (typeof document === 'undefined') {
      return ordered;
    }

    // A thread the server places nowhere but the text still marks is anchored.
    // The mark goes on as soon as the thread is created and only reaches the
    // server with the next passage save, and telling an author their new
    // comment is attached to nothing would be a lie the text contradicts.
    const pending = ordered.unanchored.filter(({ thread }) =>
      document.querySelector(anchorSelector(thread.uuid)),
    );

    if (pending.length === 0) {
      return ordered;
    }

    const pendingUuids = new Set(pending.map(({ thread }) => thread.uuid));

    return {
      anchored: [...ordered.anchored, ...pending],
      unanchored: ordered.unanchored.filter(
        ({ thread }) => !pendingUuids.has(thread.uuid),
      ),
    };
  }, [passages]);

  const resolvedCount = useMemo(
    () =>
      [...anchored, ...unanchored].filter(({ thread }) => thread.resolvedAt)
        .length,
    [anchored, unanchored],
  );

  // A thread the panel has been pointed at stays listed whatever the filter
  // says — a deep link to a resolved thread should not open an empty panel.
  const visible = useCallback(
    (threads: PanelThread[]) =>
      showResolved
        ? threads
        : threads.filter(
            ({ thread }) =>
              !thread.resolvedAt || thread.uuid === focusedComment,
          ),
    [showResolved, focusedComment],
  );

  // A resolved thread the panel is not listing leaves no mark on the text
  // either, so the marking in the text and the list in the panel say the same
  // thing.
  const suppressed = useMemo(
    () =>
      showResolved
        ? []
        : [...anchored, ...unanchored]
            .filter(
              ({ thread }) =>
                thread.resolvedAt && thread.uuid !== focusedComment,
            )
            .map(({ thread }) => thread.uuid),
    [anchored, unanchored, showResolved, focusedComment],
  );

  // Hover wins over selection: it is the more recent intent, and it returns to
  // the selected thread on leave.
  useCommentAnchorStyles({
    highlighted: hovered ?? focusedComment,
    suppressed,
  });

  // A mark click sets the focused thread; the panel answers by bringing its
  // card into view. Asserted on the card, not on the URL, since the panel hash
  // is consumed by whatever reveals the target.
  useEffect(() => {
    if (!focusedComment) return;
    listRef.current
      ?.querySelector(
        `[data-comment-thread="${attributeValue(focusedComment)}"]`,
      )
      ?.scrollIntoView({ block: 'center' });
  }, [focusedComment, anchored, unanchored]);

  /**
   * Takes every anchor of a thread off the text.
   *
   * An anchor may sit on a static row with no editor mounted over it, so the
   * host is asked for one; `unsetComment` then clears every anchor in that
   * document at once.
   */
  const unsetAnchors = useCallback(
    async (commentUuid: string) => {
      const anchors = [
        ...document.querySelectorAll<HTMLElement>(anchorSelector(commentUuid)),
      ];
      const editors = new Set<Editor>();

      for (const anchor of anchors) {
        const editor =
          getEditorForElement(anchor) ?? (await requestEditorFor?.(anchor));
        if (editor) {
          editors.add(editor);
        }
      }

      editors.forEach((editor) =>
        editor.commands.unsetComment({ comment: commentUuid }),
      );
    },
    [requestEditorFor],
  );

  const actions: CommentActions = useMemo(
    () => ({
      reply: async (parentUuid, content) => {
        await replyToComment({ client, parentUuid, content });
        reload();
      },
      edit: async (uuid, content) => {
        await updateComment({ client, uuid, content });
        reload();
      },
      remove: async (uuid) => {
        // Anchors first: once the thread is gone a surviving mark names
        // nothing, and no read returns the thread that would prompt a cleanup.
        // Failing the other way round only leaves the thread unanchored, which
        // the panel already shows.
        await unsetAnchors(uuid);
        await deleteComment({ client, uuid });
        reload();
      },
      resolve: async (uuid, resolved) => {
        await resolveComment({ client, uuid, resolved });
        reload();
      },
      expand: async (uuid) => {
        const branch = await getCommentThread({ client, uuid, depth: 10 });
        if (!branch) return;
        setPassages((prev) => prev.map((p) => graftBranch(p, branch)));
      },
    }),
    [client, reload, unsetAnchors],
  );

  const select = useCallback(
    (uuid: string) => {
      setFocusedComment(uuid);

      // The first anchor by document position wins. A thread may be anchored in
      // several places, and the earliest is where the discussion started.
      const entry = anchored.find(({ thread }) => thread.uuid === uuid);
      const anchor = entry?.anchors[0];
      if (!anchor) return;

      // Navigate rather than scroll. The passage may be in a tab that is not
      // showing — the front matter while the translation is open — and the
      // panels are React state, so a hash the provider does not know about
      // reveals nothing. `locationForPassageType` is the same map the xmlId
      // deep link uses to place a passage; this is a passage, not the comments
      // tab, so it is the right question to ask it.
      const { panel, tab } = locationForPassageType(entry?.passageType);
      updatePanel({
        name: panel,
        state: { open: true, tab, hash: anchor.passageUuid },
      });
    },
    [anchored, setFocusedComment, updatePanel],
  );

  const anchoredVisible = visible(anchored);
  const unanchoredVisible = visible(unanchored);

  return (
    <div ref={listRef} className="pb-8">
      {resolvedCount > 0 && (
        <div className="flex justify-end">
          <Button
            size="xs"
            variant="ghost"
            className="text-[11px] text-muted-foreground"
            onClick={() => setShowResolved((shown) => !shown)}
          >
            {showResolved ? 'Hide resolved' : `Show ${resolvedCount} resolved`}
          </Button>
        </div>
      )}

      {loading && (
        <p className="text-xs text-muted-foreground py-4">Loading comments…</p>
      )}

      {!loading &&
        anchoredVisible.length === 0 &&
        unanchoredVisible.length === 0 && (
          <p className="text-xs text-muted-foreground py-4">
            No comments on the passages in view.
          </p>
        )}

      <div className="flex flex-col gap-2">
        {anchoredVisible.map(({ thread, anchors, passageLabel }) => (
          <div key={thread.uuid}>
            {passageLabel && (
              <p className="text-[11px] text-muted-foreground mb-0.5">
                {passageLabel}
              </p>
            )}
            <CommentThreadCard
              thread={thread}
              currentUserId={currentUserId}
              selected={focusedComment === thread.uuid}
              anchorCount={anchors.length}
              actions={actions}
              onHover={setHovered}
              onSelect={select}
            />
          </div>
        ))}
      </div>

      {unanchoredVisible.length > 0 && (
        <div className="mt-4">
          {/* Kept visible rather than dropped. An anchor can vanish from a
              client serialization gap as easily as from a deliberate unmark, so
              a hidden thread would be indistinguishable from data loss. */}
          <p className="text-[11px] text-muted-foreground mb-1">
            Unanchored — no longer attached to any text
          </p>
          <div className="flex flex-col gap-2">
            {unanchoredVisible.map(({ thread }) => (
              <CommentThreadCard
                key={thread.uuid}
                thread={thread}
                currentUserId={currentUserId}
                selected={focusedComment === thread.uuid}
                actions={actions}
                onHover={setHovered}
                onSelect={setFocusedComment}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/** Replaces a comment anywhere in a passage's threads with a deeper read of it. */
const graftBranch = (
  passage: PassageComments,
  branch: CommentThread,
): PassageComments => {
  const graft = (comment: CommentThread): CommentThread =>
    comment.uuid === branch.uuid
      ? branch
      : { ...comment, replies: comment.replies.map(graft) };

  return {
    ...passage,
    anchored: passage.anchored.map((entry) => ({
      ...entry,
      thread: graft(entry.thread),
    })),
    unanchored: passage.unanchored.map(graft),
  };
};
