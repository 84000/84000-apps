'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  FRONT_MATTER_FILTER,
} from '@eightyfourthousand/data-access';
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
  loadBibliographyWork,
  saveBibliographyWork,
  unsavedBibliographyChanges,
  type BibliographyWork,
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

/** The tab the bibliography is drawn in, from its own work. */
const BIBLIOGRAPHY_TAB = 'bibliography';

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
  /**
   * The bibliography, as a work of its own: its rows are not passages, so it
   * saves, and undoes, apart from them. Null when it could not be read.
   */
  bibliography: BibliographyWork | null;
  /** The view for a tab, or null when this provider does not draw it. */
  controllerFor: (tab: string) => PassageStackController | null;
  /** Whether every view is read-only, as the provider was told. */
  readOnly: boolean;
};

/** What the loader builds, before the provider adds its own state. */
type LoadedStackWork = Omit<StackWork, 'readOnly'> & {
  controllers: PassageStackController[];
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
  // Read when the views are built, so they start in the current mode.
  const readOnlyRef = useRef(readOnly);
  useEffect(() => {
    readOnlyRef.current = readOnly;
    stack?.controllers.forEach((controller) =>
      controller.setReadOnly(readOnly),
    );
  }, [stack, readOnly]);
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

  useEffect(() => {
    let cancelled = false;
    const client = createGraphQLClient();
    const extras = new Map<string, PassageExtras>();
    const work = createStackWork({ workUuid, client, extras });
    const controllers = new Map<string, PassageStackController>();
    // Its own work, so it reads alongside the passages rather than after.
    const readingBibliography = loadBibliographyWork({
      workUuid,
      client: createBrowserClient(),
      graphql: client,
    });

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
            readOnly: readOnlyRef.current,
          }),
        );
      }

      const bibliography = await readingBibliography;
      if (cancelled) return;
      if (bibliography) {
        controllers.set(
          BIBLIOGRAPHY_TAB,
          new PassageStackController({
            work: bibliography.work,
            tab: BIBLIOGRAPHY_TAB,
            rows: 'bibliography',
            readOnly: readOnlyRef.current,
          }),
        );
      }

      setStack({
        work,
        bibliography,
        controllerFor: (tab) => controllers.get(tab) ?? null,
        controllers: [...controllers.values()],
      });
    })();

    return () => {
      cancelled = true;
      setStack(null);
      controllers.forEach((controller) => controller.destroy());
      work.destroy();
      void readingBibliography.then((bibliography) =>
        bibliography?.work.destroy(),
      );
    };
  }, [workUuid]);

  const value = useMemo<StackWork | null>(
    () =>
      stack && {
        work: stack.work,
        bibliography: stack.bibliography,
        controllerFor: stack.controllerFor,
        readOnly,
      },
    [stack, readOnly],
  );

  return (
    <StackWorkContext.Provider value={value}>
      {children}
    </StackWorkContext.Provider>
  );
};

/** The shared work, or null while it is still being seeded. */
export const useStackWork = () => useContext(StackWorkContext);
