'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from 'react';
import { createGraphQLClient } from '@eightyfourthousand/client-graphql';
import {
  BODY_MATTER_FILTER,
  createBrowserClient,
  FRONT_MATTER_FILTER,
} from '@eightyfourthousand/data-access';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import type { StackController } from './StackController';
import {
  loadBibliographyWork,
  type BibliographyWork,
} from './bibliography-work';
import { SpineFeed, type SpineSection } from './spine-feed';
import { createStackWork } from './stack-work';
import type { PassageExtras, PassageStackControllerOptions } from './types';

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

export type StackWork = {
  work: WorkDocument;
  /**
   * The bibliography, as a work of its own: its rows are not passages, so it
   * saves, and undoes, apart from them. Null when it could not be read.
   */
  bibliography: BibliographyWork | null;
  /** The view for a tab, or null when this provider does not draw it. */
  controllerFor: (tab: string) => StackController | null;
  /** Whether every view is read-only, as the provider was told. */
  readOnly: boolean;
};

/** What the loader builds, before the provider adds its own state. */
export type LoadedStackWork = Omit<StackWork, 'readOnly'> & {
  controllers: StackController[];
};

/** Builds a tab's view: a reader's, or one that can edit. */
export type StackViewFactory = (
  options: PassageStackControllerOptions,
) => StackController;

const StackWorkContext = createContext<StackWork | null>(null);

/**
 * Load a work's sections and bibliography into views, and keep the views in
 * the mode asked for.
 *
 * The state lives with the caller so its own effects, declared before this
 * hook, are torn down before the work they observe is destroyed.
 */
export const useStackWorkLoad = ({
  workUuid,
  readOnly,
  stack,
  setStack,
  createView,
}: {
  workUuid: string;
  readOnly: boolean;
  stack: LoadedStackWork | null;
  setStack: Dispatch<SetStateAction<LoadedStackWork | null>>;
  /** Keep it stable: a new one reloads the work. */
  createView: StackViewFactory;
}) => {
  // Read when the views are built, so they start in the current mode.
  const readOnlyRef = useRef(readOnly);
  useEffect(() => {
    readOnlyRef.current = readOnly;
    stack?.controllers.forEach((controller) =>
      controller.setReadOnly(readOnly),
    );
  }, [stack, readOnly]);

  useEffect(() => {
    let cancelled = false;
    const client = createGraphQLClient();
    const extras = new Map<string, PassageExtras>();
    const work = createStackWork({ workUuid, client, extras });
    const controllers = new Map<string, StackController>();
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
          createView({
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
          createView({
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
  }, [workUuid, setStack, createView]);
};

/** Offer a loaded work to the stacks drawn under it. */
export const StackWorkContextProvider = ({
  stack,
  readOnly,
  children,
}: {
  stack: LoadedStackWork | null;
  readOnly: boolean;
  children: ReactNode;
}) => {
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
