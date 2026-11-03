'use client';

import {
  type MouseEvent,
  RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { GraphQLClient } from 'graphql-request';
import type { Work } from '@eightyfourthousand/data-access';
import { toast } from '@eightyfourthousand/design-system';
import { type DirtyStore } from './hooks/useDirtyStore';
import {
  canReload,
  judgeSave,
  readStored,
  type SaveVerdict,
} from './save-outcome';
import type {
  SaveHandler,
  SaveReport,
  UnconfirmedSave,
} from './editor-context';

/** One toast for a save with an unknown outcome, updated as it resolves. */
const UNKNOWN_SAVE_TOAST = 'save-outcome-unknown';

/**
 * Show or update that toast. Sonner merges an update into the toast it
 * replaces, so an action is cleared unless one is given.
 */
const outcomeToast = (title: string, options: Parameters<typeof toast>[1]) =>
  toast(title, { action: undefined, ...options, id: UNKNOWN_SAVE_TOAST });

const changes = (n: number) => `${n} unsaved ${n === 1 ? 'change' : 'changes'}`;

/**
 * Saves through the registered save handler.
 *
 * A save whose answer was lost may have been applied. One that only changed
 * content is sent again by the next save. Any other is never sent again until
 * the stored passages are read back. Not applied, its changes are kept for the
 * next save. Otherwise `reload` replaces the editors with what the server
 * holds, unless that would discard newer changes, in which case saving pauses
 * until the user reloads.
 */
export const useSaveLifecycle = ({
  client,
  work,
  isSavingRef,
  saveHandlerRef,
  dirtyStore,
  reload,
}: {
  client: GraphQLClient;
  work: Work;
  isSavingRef: RefObject<boolean>;
  saveHandlerRef: RefObject<SaveHandler | null>;
  dirtyStore: DirtyStore;
  /** Replace the editors with what the server holds. */
  reload: () => void;
}) => {
  /** A save with an unknown outcome, held until it is read back. */
  const pendingRef = useRef<UnconfirmedSave | null>(null);
  /** False once the session is torn down, as a reload does. */
  const aliveRef = useRef(true);

  // A session torn down by a reload settles nothing more, including a save
  // whose answer arrives later.
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      pendingRef.current = null;
    };
  }, []);

  /** Hold a save with an unknown outcome, and say why saving is paused. */
  const pause = useCallback(
    (
      pending: UnconfirmedSave,
      title: string,
      description: string,
      action?: {
        label: string;
        onClick: (event: MouseEvent<HTMLButtonElement>) => void;
      },
    ) => {
      pendingRef.current = pending;
      dirtyStore.setDirty(true);
      outcomeToast(title, {
        description,
        icon: <CircleAlertIcon className="size-4 text-error" />,
        duration: Infinity,
        action,
      });
    },
    [dirtyStore],
  );

  /**
   * Where the editors' edits stand. Two equal snapshots mean no edit came in
   * between, so the same changes would be discarded.
   */
  const editSnapshot = useCallback(
    (pending: UnconfirmedSave) =>
      [saveHandlerRef.current?.revision?.() ?? 0, pending.newerChanges()].join(),
    [saveHandlerRef],
  );

  /**
   * Replace the editors with what the server holds, once the work can be read,
   * and only over unsaved changes the user agreed to discard. Until then the
   * editors, and the save, stay as they are.
   */
  const reloadWhenSafe = useCallback(
    (pending: UnconfirmedSave, verdict: SaveVerdict) => {
      const title =
        verdict === 'applied'
          ? 'Your last save went through.'
          : 'Your last save may have gone through.';
      const discarded = () => pending.newerChanges();

      /** Reload, if no edit came in since `agreed` was taken. */
      const run = async (agreed: string): Promise<void> => {
        const readable = await canReload(client, work.uuid, pending.sent);
        // Settled by a later save, or the session is gone.
        if (pendingRef.current !== pending) return;
        if (!readable) {
          return pause(
            pending,
            title,
            'The work could not be read to show what is saved, so saving is ' +
              'paused and your changes are kept. Save again to retry.',
          );
        }
        // The one check, with nothing awaited between it and the reload: an
        // edit since the user agreed is never discarded unasked.
        if (editSnapshot(pending) !== agreed && discarded() > 0) {
          return askToDiscard();
        }

        pendingRef.current = null;
        outcomeToast(title, {
          description:
            'Its answer was lost, so the editor now shows what is saved. ' +
            'Check your recent changes there before making any of them again.',
          icon: <TriangleAlertIcon className="size-4 text-warning" />,
          duration: Infinity,
        });
        reload();
      };

      const askToDiscard = () => {
        const agreed = editSnapshot(pending);
        pause(
          pending,
          verdict === 'applied'
            ? 'Your last save went through, but its answer was lost.'
            : title,
          `Saving is paused. Reloading shows what is saved, and will discard ` +
            `${changes(discarded())}. Copy anything you want to keep before ` +
            'you reload.',
          {
            label: 'Reload',
            onClick: (event) => {
              // Settled since: the warning has nothing left to do.
              if (pendingRef.current !== pending) return;
              // Keep the warning up; what comes of the reload replaces it.
              event.preventDefault();
              // One at a time with saves.
              if (isSavingRef.current) return;
              isSavingRef.current = true;
              void run(agreed).finally(() => {
                isSavingRef.current = false;
              });
            },
          },
        );
      };

      if (discarded() > 0) return askToDiscard();
      return run(editSnapshot(pending));
    },
    [client, work.uuid, pause, reload, isSavingRef, editSnapshot],
  );

  /**
   * Read back the passages of a save with an unknown outcome to learn whether
   * it was applied. A save that was not is handed back to the next save.
   * Otherwise the editors show what the server holds, unless that would
   * discard newer changes: then saving pauses, and the user chooses to reload.
   */
  const confirmUnknownSave = useCallback(
    async (pending: UnconfirmedSave) => {
      if (!aliveRef.current) return;
      pendingRef.current = pending;
      const stored = await readStored([...pending.sent, ...pending.deleted]);
      if (pendingRef.current !== pending) return;
      if (!stored) {
        pause(
          pending,
          'Your last save may have gone through.',
          'The server could not be reached to check, so saving is paused and ' +
            'your changes are kept. Save again to check.',
        );
        return;
      }

      const verdict = judgeSave(stored, pending);
      if (verdict === 'not-applied') {
        pendingRef.current = null;
        await pending.restore();
        if (!aliveRef.current) return;
        dirtyStore.setDirty(true);
        outcomeToast('Your last save did not go through.', {
          description: 'Your changes are kept. Save again to send them.',
          icon: <CircleAlertIcon className="size-4 text-error" />,
        });
        return;
      }
      await reloadWhenSafe(pending, verdict);
    },
    [dirtyStore, pause, reloadWhenSafe],
  );

  const save = useCallback(async () => {
    if (isSavingRef.current) {
      console.warn('Save already in progress; skipping.');
      return;
    }
    isSavingRef.current = true;
    try {
      if (pendingRef.current) {
        await confirmUnknownSave(pendingRef.current);
        return;
      }

      const stack = saveHandlerRef.current;
      const report: SaveReport = stack
        ? await stack.save().catch((error: unknown) => {
            console.error('Save failed:', error);
            return { outcome: 'failed' as const };
          })
        : { outcome: 'none' };
      // A session gone meanwhile reports nothing over the next one's toasts.
      if (!aliveRef.current) return;
      if (report.unconfirmed) {
        if (report.unconfirmed.replayable) {
          // Only content was sent, so the next save sends it again.
          outcomeToast('Your last save could not be confirmed.', {
            description:
              'Your changes are kept, and the next save sends them again.',
            icon: <TriangleAlertIcon className="size-4 text-warning" />,
          });
          dirtyStore.setDirty(true);
          return;
        }
        // The work's state is uncertain: send nothing more until it is read.
        await confirmUnknownSave(report.unconfirmed);
        return;
      }

      if (report.outcome === 'failed') {
        toast('Error saving content.', {
          icon: <CircleAlertIcon className="size-4 text-error" />,
        });
      } else if (report.outcome === 'saved') {
        toast('Content saved', {
          icon: <CircleCheckIcon className="size-4 text-success" />,
        });
      } else {
        console.log('No changes to save.');
      }

      dirtyStore.setDirty(stack?.isDirty() ?? false);
    } finally {
      isSavingRef.current = false;
    }
  }, [confirmUnknownSave, dirtyStore, isSavingRef, saveHandlerRef]);

  return { save };
};
