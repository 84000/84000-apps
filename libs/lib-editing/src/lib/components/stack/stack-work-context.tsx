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
import { createBrowserClient } from '@eightyfourthousand/data-access';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';
import type { GraphQLClient } from 'graphql-request';

import type { StackController } from './StackController';
import {
  loadBibliographyWork,
  type BibliographyWork,
} from './bibliography-work';
import { SpineFeed } from './spine-feed';
import {
  BIBLIOGRAPHY_TAB,
  STACK_SECTIONS,
  type StackReaderSeed,
} from './stack-seed';
import { createStackWork } from './stack-work';
import type { PassageExtras, PassageStackControllerOptions } from './types';

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

/** A loaded work's views, by tab, and the work they share. */
type StackViews = {
  work: WorkDocument;
  extras: Map<string, PassageExtras>;
  controllers: Map<string, StackController>;
};

const loadedFrom = (
  { work, controllers }: StackViews,
  bibliography: BibliographyWork | null,
): LoadedStackWork => ({
  work,
  bibliography,
  controllerFor: (tab) => controllers.get(tab) ?? null,
  controllers: [...controllers.values()],
});

/** A work's views, built from what a server read for it. */
const viewsFromSeed = ({
  seed,
  client,
  readOnly,
  createView,
}: {
  seed: StackReaderSeed;
  client: GraphQLClient;
  readOnly: boolean;
  createView: StackViewFactory;
}): StackViews => {
  const extras = new Map<string, PassageExtras>();
  const work = createStackWork({ workUuid: seed.workUuid, client, extras });
  const controllers = new Map<string, StackController>();
  for (const section of STACK_SECTIONS) {
    const seeded = seed.sections.find(({ tab }) => tab === section.tab);
    const feed = new SpineFeed(work, client, section);
    feed.seedFrom(
      seeded?.page ?? { metas: [], hasMoreAfter: false, hasMoreBefore: false },
    );
    seeded?.passages.forEach(({ uuid, content, extras: row }) => {
      if (work.spine.indexOf(uuid) < 0 || work.store.has(uuid)) return;
      work.store.create(uuid, content);
      extras.set(uuid, row ?? {});
    });
    controllers.set(
      section.tab,
      createView({
        work,
        tab: section.tab,
        spineFeed: feed,
        extras,
        readOnly,
        serverRendered: true,
      }),
    );
  }
  return { work, extras, controllers };
};

/**
 * A work loaded from what a server read for it, built in the first render so
 * the server can draw it. The bibliography follows from the browser.
 */
export const seedStackWork = ({
  seed,
  readOnly,
  createView,
}: {
  seed: StackReaderSeed;
  readOnly: boolean;
  createView: StackViewFactory;
}): LoadedStackWork =>
  loadedFrom(
    viewsFromSeed({
      seed,
      client: createGraphQLClient(),
      readOnly,
      createView,
    }),
    null,
  );

/**
 * Load a work's sections and bibliography into views, and keep the views in
 * the mode asked for.
 *
 * The state lives with the caller so its own effects, declared before this
 * hook, are torn down before the work they observe is destroyed.
 *
 * With a `seed` for this work the sections need no request. A stack the caller
 * built from it in its first render is adopted rather than rebuilt, so the rows
 * the server drew stay the rows the browser draws.
 */
export const useStackWorkLoad = ({
  workUuid,
  readOnly,
  stack,
  setStack,
  createView,
  seed,
}: {
  workUuid: string;
  readOnly: boolean;
  stack: LoadedStackWork | null;
  setStack: Dispatch<SetStateAction<LoadedStackWork | null>>;
  /** Keep it stable: a new one reloads the work. */
  createView: StackViewFactory;
  /** What a server read for the work, if it read it. */
  seed?: StackReaderSeed;
}) => {
  // Read when the views are built, so they start in the current mode.
  const readOnlyRef = useRef(readOnly);
  useEffect(() => {
    readOnlyRef.current = readOnly;
    stack?.controllers.forEach((controller) =>
      controller.setReadOnly(readOnly),
    );
  }, [stack, readOnly]);

  // The stack as the first render left it: built from the seed, if there was
  // one. Taken once.
  const firstRef = useRef(stack);

  useEffect(() => {
    let cancelled = false;
    const client = createGraphQLClient();
    const first = firstRef.current;
    firstRef.current = null;

    const seeded = seed?.workUuid === workUuid ? seed : undefined;
    const adopted = seeded && first?.work.workUuid === workUuid ? first : null;
    const views: StackViews = adopted
      ? {
          work: adopted.work,
          extras: new Map(),
          controllers: new Map(
            STACK_SECTIONS.flatMap(({ tab }) => {
              const view = adopted.controllerFor(tab);
              return view ? [[tab, view] as const] : [];
            }),
          ),
        }
      : seeded
        ? viewsFromSeed({
            seed: seeded,
            client,
            readOnly: readOnlyRef.current,
            createView,
          })
        : (() => {
            const extras = new Map<string, PassageExtras>();
            return {
              work: createStackWork({ workUuid, client, extras }),
              extras,
              controllers: new Map<string, StackController>(),
            };
          })();
    const { work, extras, controllers } = views;
    // Its own work, so it reads alongside the passages rather than after.
    const readingBibliography = loadBibliographyWork({
      workUuid,
      client: createBrowserClient(),
      graphql: client,
    });
    if (seeded && !adopted) setStack(loadedFrom(views, null));

    void (async () => {
      // Sequentially, not in parallel: each run is placed relative to the ones
      // already in the spine.
      for (const section of seeded ? [] : STACK_SECTIONS) {
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
      // A seeded work is already drawn; it only gains its bibliography.
      if (!seeded || bibliography) setStack(loadedFrom(views, bibliography));
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
  }, [workUuid, setStack, createView, seed]);
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
