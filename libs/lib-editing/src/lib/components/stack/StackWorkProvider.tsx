'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createBrowserClient } from '@eightyfourthousand/data-access';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import {
  useEditorState,
  type SaveOutcome,
  type SaveReport,
} from '../editor/EditorProvider';
import { combineSaveOutcomes } from '../editor/save-bookkeeping';
import { useNavigation } from '../shared/NavigationContext';
import {
  DEFAULT_TAB_FOR_PANEL,
  type PanelName,
  type PanelState,
  type TabName,
} from '../shared/types';
import { PassageStackController } from './PassageStackController';
import {
  saveBibliographyWork,
  unsavedBibliographyChanges,
} from './bibliography-work';
import {
  applyServerPassages,
  hasUnsavedStackChanges,
  saveStackWork,
  trackEdits,
  unsavedStackChanges,
} from './stack-save';
import { removeStackCommentAnchors } from './stack-comments';
import { deleteStackEndnote } from './stack-endnotes';
import {
  StackWorkContextProvider,
  useStackWorkLoad,
  type LoadedStackWork,
  type StackViewFactory,
} from './stack-work-context';

export {
  useStackWork,
  type StackWork,
  type LoadedStackWork,
} from './stack-work-context';

/** Views that can edit. */
const createEditingView: StackViewFactory = (options) =>
  new PassageStackController(options);

/** Whether a panel is showing a tab's passages; Compare draws Translation's. */
const showsTab = (
  state: PanelState | undefined,
  panel: PanelName,
  tab: string,
) => {
  if (!state?.open) return false;
  const drawn = state.tab ?? DEFAULT_TAB_FOR_PANEL[panel];
  return (drawn === 'compare' ? 'translation' : drawn) === tab;
};

/**
 * One `WorkDocument` for a work, with a view per editor tab over it.
 *
 * One spine and one command log, so an endnote link and the endnote passage it
 * creates undo together — they are two panels but one document.
 *
 * Null until the sections have been seeded: a view over an empty spine draws
 * nothing and reports a visible range of zero, which the loader would take as
 * a window and answer.
 *
 * `readOnly` makes every view a reader's: no row mounts an editor and nothing
 * edits the work. It can change while the stack is drawn.
 */
export const StackWorkProvider = ({
  workUuid,
  readOnly = false,
  children,
}: {
  workUuid: string;
  /** Draw every view read-only. Defaults to false. */
  readOnly?: boolean;
  children: ReactNode;
}) => {
  const [stack, setStack] = useState<LoadedStackWork | null>(null);
  const { registerSaveHandler, dirtyStore } = useEditorState();

  // The editor's save button materializes rows from one TipTap editor per tab,
  // which per-passage documents do not have. This provider cannot be called
  // into from `EditorProvider` — the stack sits behind a dynamic boundary — so
  // it registers its own save to run alongside.
  useEffect(() => {
    if (!stack) return;
    const { work, bibliography } = stack;
    const unsavedRows = () =>
      bibliography ? unsavedBibliographyChanges(bibliography) : 0;
    const isDirty = () => hasUnsavedStackChanges(work) || unsavedRows() > 0;
    const edits = trackEdits(bibliography ? [work, bibliography.work] : [work]);
    registerSaveHandler({
      // One save for both works. Each writes on its own, so one failing does
      // not hold back the other.
      save: async () => {
        const passages: SaveReport = hasUnsavedStackChanges(work)
          ? await saveStackWork(work)
          : { outcome: 'none' };
        const rows: SaveOutcome =
          !bibliography || !unsavedRows()
            ? 'none'
            : (await saveBibliographyWork(bibliography, createBrowserClient()))
              ? 'saved'
              : 'failed';
        const outcome = combineSaveOutcomes([passages.outcome, rows]);
        const { unconfirmed } = passages;
        if (!unconfirmed) return { outcome };
        // A reload would discard the rows too.
        return {
          outcome,
          unconfirmed: {
            ...unconfirmed,
            newerChanges: () => unconfirmed.newerChanges() + unsavedRows(),
          },
        };
      },
      isDirty,
      unsavedChanges: () => unsavedStackChanges(work) + unsavedRows(),
      revision: edits.revision,
      applyReplaced: (passages) => applyServerPassages(work, passages),
      deleteEndnote: (endNote) => deleteStackEndnote({ stack, endNote }),
      removeCommentAnchors: (comment) =>
        [work, bibliography?.work].forEach(
          (each) => each && removeStackCommentAnchors(each, comment),
        ),
    });
    // Offer the save as soon as there is something to save. Clearing it is
    // the save's job, which knows about the paginated editors too.
    const offer = () => {
      if (isDirty()) dirtyStore.setDirty(true);
    };
    const stops = [work, bibliography?.work].flatMap((each) =>
      each ? [each.store.observe(offer), each.spine.observe(offer)] : [],
    );
    return () => {
      stops.forEach((stop) => stop());
      edits.stop();
      registerSaveHandler(null);
    };
  }, [stack, registerSaveHandler, dirtyStore]);

  const { panels, updatePanel } = useNavigation();

  // The work last worked in, whose history the page's undo and redo take.
  const activeWork = useRef<WorkDocument | null>(null);
  useEffect(() => {
    activeWork.current = null;
    if (!stack) return;
    const onEnter = (event: Event) => {
      const uuid = (event.target as HTMLElement | null)
        ?.closest?.('[data-stack-passage]')
        ?.getAttribute('data-stack-passage');
      if (!uuid) return;
      activeWork.current =
        [stack.work, stack.bibliography?.work].find((each) =>
          each?.spine.meta(uuid),
        ) ?? activeWork.current;
    };
    document.addEventListener('focusin', onEnter);
    document.addEventListener('pointerdown', onEnter);
    return () => {
      document.removeEventListener('focusin', onEnter);
      document.removeEventListener('pointerdown', onEnter);
    };
  }, [stack]);

  // Undo and redo with focus outside any editor, such as after a label-menu
  // action. The editors bind their own; this covers the rest of the page.
  useEffect(() => {
    if (!stack || readOnly) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // An editor handled it. Its undo can move focus and tear the editor
      // down, so the target no longer reads as one.
      if (event.defaultPrevented) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest?.('input, textarea, select, [contenteditable="true"]')
      ) {
        return;
      }
      const redo = key === 'y' || event.shiftKey;
      const work = activeWork.current ?? stack.work;
      const focus = work.log.suppress(() => (redo ? work.redo() : work.undo()));
      if (focus === null) return;
      event.preventDefault();
      if (!focus) return;
      const meta = work.spine.meta(focus.uuid);
      if (!meta) return;
      // The passage may sit in a tab that isn't showing.
      const panel = meta.panel as PanelName;
      if (!showsTab(panels[panel], panel, meta.tab)) {
        updatePanel({
          name: panel,
          state: { open: true, tab: meta.tab as TabName },
        });
      }
      stack.controllerFor(meta.tab)?.focusPassage(focus.uuid, focus.where);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [stack, readOnly, panels, updatePanel]);

  useStackWorkLoad({
    workUuid,
    readOnly,
    stack,
    setStack,
    createView: createEditingView,
  });

  return (
    <StackWorkContextProvider stack={stack} readOnly={readOnly}>
      {children}
    </StackWorkContextProvider>
  );
};
