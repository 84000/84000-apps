'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import { BODY_MATTER_FILTER } from '@eightyfourthousand/data-access';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import { useEditorState } from '../editor/EditorProvider';
import { PassageStackController } from './PassageStackController';
import {
  applyServerPassages,
  hasUnsavedStackChanges,
  saveStackWork,
} from './stack-save';
import { deleteStackEndnote } from './stack-endnotes';
import { SpineFeed, type SpineSection } from './spine-feed';
import { createStackWork } from './stack-work';

/**
 * The sections drawn as stacks, **in the order the work reads**.
 *
 * Order is load bearing: a section whose run is still empty is appended at the
 * end of the spine, so seeding them out of order would put the back matter
 * before the body.
 */
const SECTIONS: SpineSection[] = [
  { tab: 'translation', type: BODY_MATTER_FILTER },
  { tab: 'endnotes', type: 'endnotes' },
];

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

  useEffect(() => {
    let cancelled = false;
    const client = createGraphQLClient();
    const work = createStackWork({ workUuid, client });
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
