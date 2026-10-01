'use client';

import { RefObject, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react';
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
import type {
  EditorContextState,
  SaveHandler,
  SaveOutcome,
} from './editor-context';

type SaveResult = { outcome: SaveOutcome; dirty: boolean };

/** Saves the paginated editors and any registered save handler as one. */
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
}) => {
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
      const result = await savePassages({
        client,
        passages,
        deletedUuids: deletedUuids.length > 0 ? deletedUuids : undefined,
      });

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
      return { outcome: 'saved', dirty: residual.hasChanges };
    } catch (error) {
      // A throw anywhere past the swap, the request included, confirmed
      // nothing, and must not take the in-flight set down with it.
      console.error('Save failed:', error);
      dirtyUuidsRef.current = restoreFailedSave(
        inFlightDirty,
        dirtyUuidsRef.current,
      );
      return { outcome: 'failed', dirty: true };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs are the provider's, so stable
  }, [client, work.uuid, getEditorUuids, applyReplacedPassages, setNavigating]);

  // The stack, when it is mounted, and the paginated editors each save what
  // they hold; one button and one toast cover both.
  const save = useCallback(async () => {
    if (isSavingRef.current) {
      console.warn('Save already in progress; skipping.');
      return;
    }
    isSavingRef.current = true;
    try {
      const stack = saveHandlerRef.current;
      const stackOutcome: SaveOutcome = stack
        ? await stack.save().catch((error: unknown) => {
            console.error('Save failed:', error);
            return 'failed' as const;
          })
        : 'none';
      const paginated = await savePaginated();
      const outcome = combineSaveOutcomes([stackOutcome, paginated.outcome]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the refs are the provider's, so stable
  }, [savePaginated, dirtyStore]);

  return { save };
};
