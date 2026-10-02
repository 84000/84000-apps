'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import {
  BODY_MATTER_FILTER,
  FRONT_MATTER_FILTER,
} from '@eightyfourthousand/data-access';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import { useEditorState } from '../editor/EditorProvider';
import { useNavigation } from '../shared/NavigationContext';
import {
  DEFAULT_TAB_FOR_PANEL,
  type PanelName,
  type PanelState,
  type TabName,
} from '../shared/types';
import { PassageStackController } from './PassageStackController';
import {
  applyServerPassages,
  hasUnsavedStackChanges,
  saveStackWork,
} from './stack-save';
import { removeStackCommentAnchors } from './stack-comments';
import { deleteStackEndnote } from './stack-endnotes';
import { SpineFeed, type SpineSection } from './spine-feed';
import { createStackWork } from './stack-work';
import type { PassageExtras } from './types';

/**
 * The sections drawn as stacks, **in the order the work reads**.
 *
 * Order is load bearing: a section whose run is still empty is appended at the
 * end of the spine, so seeding them out of order would put the back matter
 * before the body.
 */
const SECTIONS: SpineSection[] = [
  // The filter matches each type's `*Header` too.
  { tab: 'front', type: FRONT_MATTER_FILTER },
  { tab: 'translation', type: BODY_MATTER_FILTER },
  // Between the body and the notes, as every work that has them reads.
  { tab: 'abbreviations', type: 'abbreviations' },
  { tab: 'endnotes', type: 'endnotes' },
];

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

export type StackWork = {
  work: WorkDocument;
  /** The view for a tab, or null when this provider does not draw it. */
  controllerFor: (tab: string) => PassageStackController | null;
};

const StackWorkContext = createContext<StackWork | null>(null);

/**
 * One `WorkDocument` for a work, with a view per editor tab over it.
 *
 * One spine and one command log, so an endnote link and the endnote passage it
 * creates undo together — they are two panels but one document.
 *
 * Null until the sections have been seeded: a view over an empty spine draws
 * nothing and reports a visible range of zero, which the loader would take as
 * a window and answer.
 */
export const StackWorkProvider = ({
  workUuid,
  children,
}: {
  workUuid: string;
  children: ReactNode;
}) => {
  const [stack, setStack] = useState<StackWork | null>(null);
  const { registerSaveHandler, dirtyStore } = useEditorState();

  // The editor's save button materializes rows from one TipTap editor per tab,
  // which per-passage documents do not have. This provider cannot be called
  // into from `EditorProvider` — the stack sits behind a dynamic boundary — so
  // it registers its own save to run alongside.
  useEffect(() => {
    if (!stack) return;
    const { work } = stack;
    registerSaveHandler({
      save: async () => {
        if (!hasUnsavedStackChanges(work)) return 'none';
        return (await saveStackWork(work)) ? 'saved' : 'failed';
      },
      isDirty: () => hasUnsavedStackChanges(work),
      applyReplaced: (passages) => applyServerPassages(work, passages),
      deleteEndnote: (endNote) => deleteStackEndnote({ stack, endNote }),
      removeCommentAnchors: (comment) =>
        removeStackCommentAnchors(work, comment),
    });
    // Offer the save as soon as there is something to save. Clearing it is
    // the save's job, which knows about the paginated editors too.
    const offer = () => {
      if (hasUnsavedStackChanges(work)) dirtyStore.setDirty(true);
    };
    const stopStore = work.store.observe(offer);
    const stopSpine = work.spine.observe(offer);
    return () => {
      stopStore();
      stopSpine();
      registerSaveHandler(null);
    };
  }, [stack, registerSaveHandler, dirtyStore]);

  const { panels, updatePanel } = useNavigation();

  // Undo and redo with focus outside any editor, such as after a label-menu
  // action. The editors bind their own; this covers the rest of the page, once
  // per work, since every view shares the one history.
  useEffect(() => {
    if (!stack) return;
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
      const { work } = stack;
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
  }, [stack, panels, updatePanel]);

  useEffect(() => {
    let cancelled = false;
    const client = createGraphQLClient();
    const extras = new Map<string, PassageExtras>();
    const work = createStackWork({ workUuid, client, extras });
    const controllers = new Map<string, PassageStackController>();

    void (async () => {
      // Sequentially, not in parallel: each run is placed relative to the ones
      // already in the spine.
      for (const section of SECTIONS) {
        const feed = new SpineFeed(work, client, section);
        await feed.seed();
        if (cancelled) return;
        controllers.set(
          section.tab,
          new PassageStackController({
            work,
            tab: section.tab,
            spineFeed: feed,
            extras,
          }),
        );
      }

      if (cancelled) return;
      setStack({
        work,
        controllerFor: (tab) => controllers.get(tab) ?? null,
      });
    })();

    return () => {
      cancelled = true;
      setStack(null);
      controllers.forEach((controller) => controller.destroy());
      work.destroy();
    };
  }, [workUuid]);

  return (
    <StackWorkContext.Provider value={stack}>
      {children}
    </StackWorkContext.Provider>
  );
};

/** The shared work, or null while it is still being seeded. */
export const useStackWork = () => useContext(StackWorkContext);
