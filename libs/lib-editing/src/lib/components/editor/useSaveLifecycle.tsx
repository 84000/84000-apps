'use client';

import { RefObject, useCallback, useRef } from 'react';
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
import { mayHaveBeenApplied, readBackSaved } from './save-outcome';
import type {
  EditorContextState,
  SaveHandler,
  SaveReport,
} from './editor-context';

type SaveResult = SaveReport & { dirty: boolean };

/** At most this many warnings are listed in the toast. */
const SHOWN_WARNINGS = 3;

/** One toast for a save with an unknown outcome, updated as it resolves. */
const UNKNOWN_SAVE_TOAST = 'save-outcome-unknown';

/**
 * Saves the paginated editors and any registered save handler as one.
 *
 * A save whose answer was lost may have been applied. A stack save that only
 * changed content is sent again by the next save. Any other is never sent
 * again: once its passages can be read back, `reload` replaces the editors
 * with what the server holds, and until then saving is paused.
 */
export const useSaveLifecycle = ({
  client,
  work,
  editorCache,
  dirtyUuidsRef,
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
  /** The passages of a save with an unknown outcome, not yet read back. */
  const unconfirmedRef = useRef<string[] | null>(null);

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
    const unknown = (): SaveResult => {
      dirtyUuidsRef.current = restoreFailedSave(
        inFlightDirty,
        dirtyUuidsRef.current,
      );
      // Never replayable: the baseline is refreshed on load, so it cannot
      // tell a stored passage from an inserted one.
      return {
        outcome: 'unknown',
        dirty: true,
        affected: [...uuidsToSave, ...deletedUuids],
      };
    };
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
      return {
        outcome: 'saved',
        dirty: residual.hasChanges,
        ...(result.warnings?.length ? { warnings: result.warnings } : {}),
      };
    } catch (error) {
      // A throw anywhere past the swap, the request included, confirmed
      // nothing, and must not take the in-flight set down with it.
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
  ]);

  /**
   * Read back the passages of a save with an unknown outcome, then show what
   * the server holds. When they cannot be read, change nothing and pause
   * saving: the next save tries the read again instead.
   */
  const confirmUnknownSave = useCallback(
    async (affected: string[]) => {
      if (!(await readBackSaved(client, affected))) {
        unconfirmedRef.current = affected;
        dirtyStore.setDirty(true);
        toast('Your last save may have gone through.', {
          description:
            'The server could not be reached to check, so saving is paused. ' +
            'Save again to check: the editor will then show what is saved, ' +
            'and any changes made from now on will be lost.',
          icon: <CircleAlertIcon className="size-4 text-error" />,
          duration: Infinity,
          id: UNKNOWN_SAVE_TOAST,
        });
        return;
      }
      unconfirmedRef.current = null;
      toast('Your last save may have gone through.', {
        description:
          'The editor now shows what is saved. Check your recent changes ' +
          'there before making any of them again.',
        icon: <TriangleAlertIcon className="size-4 text-warning" />,
        duration: Infinity,
        id: UNKNOWN_SAVE_TOAST,
      });
      reload();
    },
    [client, dirtyStore, reload],
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
      if (unconfirmedRef.current) {
        await confirmUnknownSave(unconfirmedRef.current);
        return;
      }
      // Offline, a request fails before it is sent; saying so keeps it from
      // looking like a save that may have been applied.
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        toast('You are offline.', {
          description: 'Your changes are kept. Save again once you are back.',
          icon: <CircleAlertIcon className="size-4 text-error" />,
        });
        return;
      }

      const stack = saveHandlerRef.current;
      const stackReport: SaveReport = stack
        ? await stack.save().catch((error: unknown) => {
            console.error('Save failed:', error);
            return { outcome: 'failed' as const };
          })
        : { outcome: 'none' };
      // The work's state is uncertain: send nothing more until it is read.
      if (stackReport.outcome === 'unknown' && !stackReport.replayable) {
        await confirmUnknownSave(stackReport.affected ?? []);
        return;
      }
      const paginated = await savePaginated();
      const outcome = combineSaveOutcomes([
        stackReport.outcome,
        paginated.outcome,
      ]);
      const warnings = [
        ...(stackReport.warnings ?? []),
        ...(paginated.warnings ?? []),
      ];
      warnings.forEach((warning) => console.warn(warning));

      const unknown = [stackReport, paginated].filter(
        (report) => report.outcome === 'unknown',
      );
      if (unknown.some((report) => !report.replayable)) {
        await confirmUnknownSave(
          unknown.flatMap((report) => report.affected ?? []),
        );
        return;
      }
      if (unknown.length) {
        // Only content was sent, so the next save sends it again.
        toast('Your last save could not be confirmed.', {
          description:
            'Your changes are kept, and the next save sends them again.',
          icon: <TriangleAlertIcon className="size-4 text-warning" />,
          id: UNKNOWN_SAVE_TOAST,
        });
        dirtyStore.setDirty(true);
        return;
      }

      if (outcome === 'failed') {
        toast('Error saving content.', {
          icon: <CircleAlertIcon className="size-4 text-error" />,
        });
      } else if (outcome === 'saved' && warnings.length) {
        const more = warnings.length - SHOWN_WARNINGS;
        toast('Content saved, with warnings', {
          description: [
            ...warnings.slice(0, SHOWN_WARNINGS),
            ...(more > 0 ? [`and ${more} more`] : []),
          ].join('\n'),
          icon: <TriangleAlertIcon className="size-4 text-warning" />,
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
    dirtyStore,
    isSavingRef,
    saveHandlerRef,
  ]);

  return { save };
};
