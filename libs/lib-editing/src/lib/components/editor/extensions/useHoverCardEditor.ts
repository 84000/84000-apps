import { Editor } from '@tiptap/core';
import { useCallback } from 'react';

/**
 * Let the card close before the document changes under it.
 *
 * Applying the edit immediately tears down the mark the popover is anchored to
 * while it is still open.
 */
const EDITOR_UPDATE_DELAY_MS = 100;

/** Resolve an editor for the anchor, mounting or focusing one if it takes that. */
export type EditorRequest = () => Promise<Editor | null>;

/**
 * Run a hover card's edit against an editor for its anchor.
 *
 * A card is drawn from the navigation fetchers and the anchor's own
 * attributes, so showing one needs no editor at all. Only the editing actions
 * do, and outside the paginated editor there may be none mounted: most of a
 * virtualized work is static HTML. So the editor is resolved when an action
 * runs rather than required for the card to exist — `requestEditor` is what
 * the host does about that, which for the passage stack means focusing the
 * passage.
 *
 * Does nothing when none can be resolved, which is the honest outcome: the
 * card had no document to change.
 */
export const useHoverCardEditor = (
  editor: Editor | undefined,
  requestEditor: EditorRequest,
) =>
  useCallback(
    (run: (editor: Editor) => void) => {
      setTimeout(async () => {
        const resolved = editor ?? (await requestEditor());
        if (!resolved || resolved.isDestroyed) return;
        run(resolved);
      }, EDITOR_UPDATE_DELAY_MS);
    },
    [editor, requestEditor],
  );
