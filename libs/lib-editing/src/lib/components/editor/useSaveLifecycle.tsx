'use client';

import {
  type MouseEvent,
  RefObject,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import { Editor } from '@tiptap/react';
import {
  CircleAlertIcon,
  CircleCheckIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import type { GraphQLClient } from 'graphql-request';
import type { Passage, Work } from '@eightyfourthousand/data-access';
import {
  type ReplacedPassage,
  savePassages,
} from '@eightyfourthousand/client-graphql';
import { toast } from '@eightyfourthousand/design-system';
import { passagesFromNodes, ensureUuids } from '../../passage';
import { type DirtyStore } from './hooks/useDirtyStore';
import { computeSavePayload, type PassageUuidRecord } from './save-filter';
import {
  beginSave,
  filterReplacements,
  combineSaveOutcomes,
  restoreFailedSave,
} from './save-bookkeeping';
import { applyRenumberedLabels } from './extensions/EndNoteLink/endnote-utils';
import {
  canReload,
  judgeSave,
  mayHaveBeenApplied,
  readStored,
  type SaveVerdict,
} from './save-outcome';
import type {
  EditorContextState,
  SaveHandler,
  SaveReport,
  UnconfirmedSave,
} from './editor-context';

type SaveResult = SaveReport & { dirty: boolean };

/** A save whose answer was lost, and what else a reload would discard. */
type PendingSave = {
  save: UnconfirmedSave;
  /** Unsaved changes outside it. */
  otherChanges: () => number;
};

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
 * Saves the paginated editors and any registered save handler as one.
 *
 * A save whose answer was lost may have been applied. A stack save that only
 * changed content is sent again by the next save. Any other is never sent
 * again until the stored passages are read back. Not applied, its changes are
 * kept for the next save. Otherwise `reload` replaces the editors with what
 * the server holds, unless that would discard newer changes, in which case
 * saving pauses until the user reloads.
 */
export const useSaveLifecycle = ({
  client,
  work,
  editorCache,
  dirtyUuidsRef,
  editsRef,
  isSavingRef,
  isNormalizingForSaveRef,
  savedBaselineUuidsByEditorRef,
  saveHandlerRef,
  dirtyStore,
  getEditorUuids,
  applyReplacedPassages,
  setNavigating,
  reload,
}: {
  client: GraphQLClient;
  work: Work;
  editorCache: RefObject<{ [key: string]: Editor }>;
  dirtyUuidsRef: RefObject<Set<string>>;
  /** Moves with every local edit to the paginated editors. */
  editsRef: RefObject<number>;
  isSavingRef: RefObject<boolean>;
  isNormalizingForSaveRef: RefObject<boolean>;
  savedBaselineUuidsByEditorRef: RefObject<PassageUuidRecord>;
  saveHandlerRef: RefObject<SaveHandler | null>;
  dirtyStore: DirtyStore;
  getEditorUuids: (editor: Editor) => Set<string>;
  applyReplacedPassages: (passages: ReplacedPassage[]) => Promise<void>;
  setNavigating: EditorContextState['setNavigating'];
  /** Replace the editors with what the server holds. */
  reload: () => void;
}) => {
  /** A save with an unknown outcome, held until it is read back. */
  const pendingRef = useRef<PendingSave | null>(null);
  /** False once the session is torn down, as a reload does. */
  const aliveRef = useRef(true);

  /** How many passages the paginated editors hold changed from `baseline`. */
  const paginatedChanges = useCallback(
    (baseline: PassageUuidRecord): number => {
      const live: PassageUuidRecord = {};
      Object.entries(editorCache.current)
        .filter(([, editor]) => !editor.isDestroyed)
        .forEach(([key, editor]) => {
          live[key] = getEditorUuids(editor);
        });
      const { uuidsToSave, uuidsToDelete } = computeSavePayload({
        dirtyUuids: dirtyUuidsRef.current,
        // As a save does: only the editors still open.
        baseline: Object.fromEntries(
          Object.entries(baseline).filter(([key]) => key in live),
        ),
        current: live,
      });
      return uuidsToSave.length + uuidsToDelete.length;
    },
    [editorCache, getEditorUuids, dirtyUuidsRef],
  );

  /** The paginated editors' half of a save. */
  const savePaginated = useCallback(async (): Promise<SaveResult> => {
    const editorEntries = Object.entries(editorCache.current).filter(
      ([, editor]) => !editor.isDestroyed,
    );
    if (!editorEntries.length) {
      return { outcome: 'none', dirty: false };
    }

    const liveUuidsByEditor: PassageUuidRecord = {};
    editorEntries.forEach(([key, editor]) => {
      liveUuidsByEditor[key] = getEditorUuids(editor);
    });
    const savedBaselineUuidsByEditor = Object.fromEntries(
      Object.keys(liveUuidsByEditor)
        .map(
          (key) => [key, savedBaselineUuidsByEditorRef.current[key]] as const,
        )
        .filter((entry): entry is readonly [string, Set<string>] =>
          Boolean(entry[1]),
        ),
    ) as PassageUuidRecord;

    const {
      uuidsToSave,
      uuidsToDelete: deletedUuids,
      hasChanges,
    } = computeSavePayload({
      dirtyUuids: dirtyUuidsRef.current,
      baseline: savedBaselineUuidsByEditor,
      current: liveUuidsByEditor,
    });

    if (!hasChanges) {
      return { outcome: 'none', dirty: false };
    }

    // Swap in a fresh dirty set before any await: keystrokes made while the
    // network round-trip is pending land in the new set and survive the
    // post-save bookkeeping instead of being silently cleared.
    const { inFlight: inFlightDirty, next } = beginSave(dirtyUuidsRef.current);
    dirtyUuidsRef.current = next;
    // The new passages, as far as the baseline knows.
    const inserted = uuidsToSave.filter(
      (uuid) =>
        !Object.values(savedBaselineUuidsByEditor).some((uuids) =>
          uuids.has(uuid),
        ),
    );
    // The in-flight set is held apart until the stored passages show whether
    // the save was applied, so the dirty set holds only what changed since.
    // Never replayable: the baseline cannot tell a stored passage from an
    // inserted one.
    const unknown = (): SaveResult => ({
      outcome: 'unknown',
      dirty: true,
      unconfirmed: {
        sent: uuidsToSave,
        inserted,
        deleted: deletedUuids,
        newerChanges: () => paginatedChanges(liveUuidsByEditor),
        restore: async () => {
          dirtyUuidsRef.current = restoreFailedSave(
            inFlightDirty,
            dirtyUuidsRef.current,
          );
        },
      },
    });
    // Set as the request starts; one that fails before it is sent says so.
    let sent = false;

    try {
      // Everything up to the await is synchronous, so the serialized payload
      // is consistent with the uuid sets captured above.
      const passages: Passage[] = [];
      if (uuidsToSave.length) {
        const uuidsToSaveSet = new Set(uuidsToSave);
        isNormalizingForSaveRef.current = true;
        try {
          editorEntries.forEach(([, editor]) => {
            const editorUuids = Array.from(getEditorUuids(editor)).filter(
              (uuid) => uuidsToSaveSet.has(uuid),
            );
            if (editorUuids.length === 0) {
              return;
            }

            ensureUuids(editor, { passageUuids: new Set(editorUuids) });
          });
        } finally {
          isNormalizingForSaveRef.current = false;
        }

        // Blur only the focused editor, once, to flush any pending IME
        // composition into ProseMirror state before the docs are read —
        // blurring editors that never had focus accomplishes nothing, and
        // the old per-editor blur/focus pair stole focus across panels and
        // scrolled the viewport on every save.
        const focusedEntry = editorEntries.find(
          ([, editor]) => editor.isFocused,
        );
        focusedEntry?.[1].commands.blur();

        editorEntries.forEach(([, editor]) => {
          const editorUuids = Array.from(getEditorUuids(editor)).filter(
            (uuid) => uuidsToSaveSet.has(uuid),
          );
          if (editorUuids.length === 0) {
            return;
          }

          passages.push(
            ...passagesFromNodes({
              uuids: editorUuids,
              workUuid: work.uuid,
              editor,
            }),
          );
        });

        // Restore focus where it was, keeping the existing selection and
        // without scrolling, before the network await so focus is never
        // visibly lost.
        focusedEntry?.[1].commands.focus(null, { scrollIntoView: false });
      }
      sent = true;
      const result = await savePassages({
        client,
        passages,
        deletedUuids: deletedUuids.length > 0 ? deletedUuids : undefined,
      });

      if (result?.outcomeUnknown) {
        console.error('Save may have been applied:', result.error);
        return unknown();
      }
      if (!result?.success) {
        // Nothing was durably confirmed; restore the attempted set so the
        // next save retries it alongside any mid-flight edits.
        dirtyUuidsRef.current = restoreFailedSave(
          inFlightDirty,
          dirtyUuidsRef.current,
        );
        console.error('Save failed:', result?.error ?? 'unknown error');
        return { outcome: 'failed', dirty: true };
      }

      result.warnings?.forEach((warning) => console.warn(warning));

      // Baselines become the uuid sets captured at save start — not the live
      // editor — so passages added or deleted during the flight are still
      // detected by the next save. Skip editors swapped out mid-flight.
      editorEntries.forEach(([key, editor]) => {
        if (editorCache.current[key] === editor && !editor.isDestroyed) {
          savedBaselineUuidsByEditorRef.current[key] = liveUuidsByEditor[key];
        }
      });

      // Server replacements must not overwrite passages the user re-edited
      // during the flight — their newer local content wins and is saved on
      // the next save.
      const replacements = filterReplacements(
        result.passages ?? [],
        dirtyUuidsRef.current,
      );
      if (replacements.length) {
        await applyReplacedPassages(replacements);
      }

      // Inserting or deleting a passage renumbers the rest of its series
      // server-side, including passages this client never loaded. Adopt those
      // labels so endnote links stop showing stale numbers without a reload.
      // `setNavigating` keeps the resulting transactions out of dirty tracking:
      // the labels came from the server, so saving them back is pointless and
      // would leave the editor permanently dirty.
      const renumbered = result.renumberedPassages ?? [];
      if (renumbered.length) {
        setNavigating(true);
        try {
          applyRenumberedLabels(Object.values(editorCache.current), renumbered);
        } finally {
          setNavigating(false);
        }
      }

      // The dirty flag reflects what is left: mid-flight edits plus any
      // structural changes that have not been saved yet.
      const residualLive: PassageUuidRecord = {};
      Object.entries(editorCache.current)
        .filter(([, editor]) => !editor.isDestroyed)
        .forEach(([key, editor]) => {
          residualLive[key] = getEditorUuids(editor);
        });
      const residual = computeSavePayload({
        dirtyUuids: dirtyUuidsRef.current,
        baseline: savedBaselineUuidsByEditorRef.current,
        current: residualLive,
      });
      return { outcome: 'saved', dirty: residual.hasChanges };
    } catch (error) {
      // A request that may have reached the server is unknown. Any other
      // throw past the swap wrote nothing, and must not take the in-flight
      // set down with it.
      if (sent && mayHaveBeenApplied(error)) {
        console.error('Save may have been applied:', error);
        return unknown();
      }
      console.error('Save failed:', error);
      dirtyUuidsRef.current = restoreFailedSave(
        inFlightDirty,
        dirtyUuidsRef.current,
      );
      return { outcome: 'failed', dirty: true };
    }
  }, [
    client,
    work.uuid,
    getEditorUuids,
    applyReplacedPassages,
    setNavigating,
    dirtyUuidsRef,
    editorCache,
    isNormalizingForSaveRef,
    savedBaselineUuidsByEditorRef,
    paginatedChanges,
  ]);

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
      pending: PendingSave,
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
    (pending: PendingSave) =>
      [
        editsRef.current,
        saveHandlerRef.current?.revision?.() ?? 0,
        pending.save.newerChanges() + pending.otherChanges(),
      ].join(),
    [editsRef, saveHandlerRef],
  );

  /**
   * Replace the editors with what the server holds, once the work can be read,
   * and only over unsaved changes the user agreed to discard. Until then the
   * editors, and the save, stay as they are.
   */
  const reloadWhenSafe = useCallback(
    (pending: PendingSave, verdict: SaveVerdict) => {
      const title =
        verdict === 'applied'
          ? 'Your last save went through.'
          : 'Your last save may have gone through.';
      const discarded = () =>
        pending.save.newerChanges() + pending.otherChanges();

      /** Reload, if no edit came in since `agreed` was taken. */
      const run = async (agreed: string): Promise<void> => {
        const readable = await canReload(client, work.uuid, pending.save.sent);
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
   * discard changes outside the save: then saving pauses, and the user
   * chooses to reload.
   */
  const confirmUnknownSave = useCallback(
    async (pending: PendingSave) => {
      if (!aliveRef.current) return;
      pendingRef.current = pending;
      const { save } = pending;
      const stored = await readStored([...save.sent, ...save.deleted]);
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

      const verdict = judgeSave(stored, save);
      if (verdict === 'not-applied') {
        pendingRef.current = null;
        await save.restore();
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

  // The stack, when it is mounted, and the paginated editors each save what
  // they hold; one button and one toast cover both.
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
      const stackReport: SaveReport = stack
        ? await stack.save().catch((error: unknown) => {
            console.error('Save failed:', error);
            return { outcome: 'failed' as const };
          })
        : { outcome: 'none' };
      // A session gone meanwhile reports nothing over the next one's toasts.
      if (!aliveRef.current) return;
      const replay = stackReport.unconfirmed?.replayable;
      // The work's state is uncertain: send nothing more until it is read.
      if (stackReport.unconfirmed && !replay) {
        await confirmUnknownSave({
          save: stackReport.unconfirmed,
          otherChanges: () =>
            paginatedChanges(savedBaselineUuidsByEditorRef.current),
        });
        return;
      }
      const paginated = await savePaginated();
      if (!aliveRef.current) return;
      if (paginated.unconfirmed) {
        await confirmUnknownSave({
          save: paginated.unconfirmed,
          otherChanges: () => stack?.unsavedChanges() ?? 0,
        });
        return;
      }
      if (replay) {
        // Only content was sent, so the next save sends it again.
        if (paginated.outcome === 'failed') {
          toast('Error saving content.', {
            icon: <CircleAlertIcon className="size-4 text-error" />,
          });
        } else {
          outcomeToast('Your last save could not be confirmed.', {
            description:
              'Your changes are kept, and the next save sends them again.',
            icon: <TriangleAlertIcon className="size-4 text-warning" />,
          });
        }
        dirtyStore.setDirty(true);
        return;
      }
      const outcome = combineSaveOutcomes([
        stackReport.outcome,
        paginated.outcome,
      ]);

      if (outcome === 'failed') {
        toast('Error saving content.', {
          icon: <CircleAlertIcon className="size-4 text-error" />,
        });
      } else if (outcome === 'saved') {
        toast('Content saved', {
          icon: <CircleCheckIcon className="size-4 text-success" />,
        });
      } else {
        console.log('No changes to save.');
      }

      dirtyStore.setDirty(paginated.dirty || (stack?.isDirty() ?? false));
    } finally {
      isSavingRef.current = false;
    }
  }, [
    savePaginated,
    confirmUnknownSave,
    paginatedChanges,
    dirtyStore,
    isSavingRef,
    saveHandlerRef,
    savedBaselineUuidsByEditorRef,
  ]);

  return { save };
};
