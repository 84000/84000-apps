'use client';

import { H3 } from '@eightyfourthousand/design-system';
import {
  AnnotationDTO,
  Passage,
  type TohokuCatalogEntry,
  annotationsFromDTO,
  createBrowserClient,
  getAnnotationsByPassageUuids,
  passageFromDTO,
  PassageDTO,
} from '@eightyfourthousand/data-access';
import {
  PassageLoader,
  type PassageSnapshot,
  type PassageSource,
  type WorkDocument,
} from '@eightyfourthousand/lib-doc-model';
import {
  NavigationProvider,
  PassageStack,
  PassageStackController,
  PerfHUD,
  StackPassageSeed,
  SpineFeed,
  createStackWork,
  createStackWorkDocument,
  stackSeedFromPassage,
} from '@eightyfourthousand/lib-editing/stack';
import {
  createGraphQLClient,
  getTranslationMetadataByToh,
} from '@eightyfourthousand/client-graphql';
import { useEffect, useMemo, useState } from 'react';

const PAGE_SIZE = 1000;
const ANNOTATION_CHUNK = 150;

const loadPassages = async (toh: string): Promise<Passage[]> => {
  const client = createBrowserClient();

  const { data: works, error: worksError } = await client
    .from('works')
    .select('uuid, toh, title');
  if (worksError) {
    console.error('failed to load works', worksError);
    return [];
  }

  const work = works?.find((candidate) =>
    (candidate.toh ?? '')
      .split(',')
      .map((entry: string) => entry.trim())
      .includes(toh),
  );
  if (!work) {
    console.error(`no work found for ${toh}`);
    return [];
  }

  let dtos: PassageDTO[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, content, xmlId, work_uuid, label, sort, parent, type, toh')
      .eq('work_uuid', work.uuid)
      .order('sort', { ascending: true })
      .order('uuid', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      console.error('failed to load passages', error);
      return [];
    }

    dtos = dtos.concat((data ?? []) as PassageDTO[]);
    if ((data?.length ?? 0) < PAGE_SIZE) break;
  }

  // Chunk the uuid filter: the whole work's uuids in one `in.(...)` makes a
  // query string past the URL limit and the request dies in the browser.
  const annotationsByPassage = new Map<string, AnnotationDTO[]>();
  const uuids = dtos.map((dto) => dto.uuid);
  for (let i = 0; i < uuids.length; i += ANNOTATION_CHUNK) {
    const chunk = await getAnnotationsByPassageUuids({
      client,
      passageUuids: uuids.slice(i, i + ANNOTATION_CHUNK),
    });
    chunk.forEach((value, key) => annotationsByPassage.set(key, value));
  }

  return dtos.map((dto) =>
    passageFromDTO(
      dto,
      annotationsFromDTO(
        annotationsByPassage.get(dto.uuid) ?? [],
        dto.content?.length ?? 0,
      ),
    ),
  );
};

/**
 * Clones the work's passages end-to-end to simulate a larger text. Clones
 * get fresh passage uuids; annotation uuids are shared across clones, which
 * is harmless in-editor (uniqueness only matters within one passage doc).
 */
const repeatPassages = (passages: Passage[], repeat: number): Passage[] => {
  if (repeat <= 1) return passages;
  const copies: Passage[] = [];
  for (let round = 0; round < repeat; round++) {
    passages.forEach((passage) => {
      copies.push(
        round === 0
          ? passage
          : {
              ...passage,
              uuid: crypto.randomUUID(),
              sort: passage.sort + round * 1_000_000,
            },
      );
    });
  }
  return copies;
};

/**
 * The seeds held as a `PassageSource`, so the sandbox drives the same windowed
 * hydration path production does rather than preloading every document.
 *
 * The rows are all in memory here — this page fetches the whole work up front
 * to measure against a large one — but handing them over a source is what
 * keeps the stack honest: documents are still built a window at a time and
 * released behind it.
 */
const seedSource = (seeds: StackPassageSeed[]): PassageSource => {
  const byUuid = new Map(seeds.map((seed) => [seed.meta.uuid, seed]));
  return {
    name: 'sandbox-seeds',
    loadPassages: async (_workUuid, uuids) =>
      uuids.flatMap((uuid): PassageSnapshot[] => {
        const seed = byUuid.get(uuid);
        return seed ? [{ uuid, content: seed.content }] : [];
      }),
    loadSpineMetas: async () => seeds.map((seed) => seed.meta),
  };
};

export const StackPage = ({
  toh,
  repeat = 1,
  overscan,
}: {
  toh: string;
  repeat?: number;
  overscan?: number;
}) => {
  const [controller, setController] = useState<PassageStackController | null>(
    null,
  );
  const [failed, setFailed] = useState(false);

  // Clear the previous stack as soon as the inputs change, rather than in the
  // fetch effect below. Adjusting state during render is React's recommended
  // alternative, and on mount there is nothing to clear.
  const loadKey = `${toh}|${repeat}`;
  const [prevLoadKey, setPrevLoadKey] = useState(loadKey);
  if (loadKey !== prevLoadKey) {
    setPrevLoadKey(loadKey);
    setController(null);
    setFailed(false);
  }

  useEffect(() => {
    let cancelled = false;

    // Two paths on purpose. The default one is production's: resolve the work,
    // seed the spine from the API, and let the stack hydrate windows through
    // the loader. `?repeat=N` keeps the DEV-706 scale harness, which clones
    // passages in memory to simulate a longer text — the server cannot serve
    // passages it does not have, so those must come from an in-memory source.
    const build = async (): Promise<PassageStackController | null> => {
      if (repeat > 1) {
        const passages = await loadPassages(toh);
        if (!passages.length) return null;
        const seeds = repeatPassages(passages, repeat).map(
          stackSeedFromPassage,
        );
        const work = createStackWorkDocument({
          workUuid: `sandbox-${toh}`,
          loader: new PassageLoader({ sources: [seedSource(seeds)] }),
        });
        work.seedSpine(seeds.map((seed) => seed.meta));
        return new PassageStackController({
          work,
          charCounts: seeds.map(
            (seed) => [seed.meta.uuid, seed.charCount] as const,
          ),
        });
      }

      const client = createGraphQLClient();
      const found = await getTranslationMetadataByToh({ client, toh });
      if (!found) {
        console.error(`no work found for ${toh}`);
        return null;
      }

      const work: WorkDocument = createStackWork({
        workUuid: found.uuid,
        client,
      });
      // The spine starts as a prefix and grows as the reader reaches its end.
      // Seeding it whole would be one request per hundred passages, and the
      // largest works in production run to about 16,000.
      const spineFeed = new SpineFeed(work, client);
      const count = await spineFeed.seed();
      if (!count) {
        console.error(`work ${found.uuid} has no passages`);
        return null;
      }

      return new PassageStackController({ work, spineFeed });
    };

    build().then((built) => {
      if (cancelled) {
        built?.destroy();
        return;
      }
      if (!built) {
        setFailed(true);
        return;
      }
      setController(built);
    });

    return () => {
      cancelled = true;
    };
  }, [toh, repeat]);

  useEffect(() => {
    if (!controller) return;
    // Debug handle for the spike: poke the spine from the console.
    (window as unknown as Record<string, unknown>)['__stackController'] =
      controller;
    return () => controller.destroy();
  }, [controller]);

  if (failed) {
    return (
      <div className="w-full px-8">
        <H3 className="px-12 py-2 text-muted-foreground">
          No passages found for {toh}. Is the local Supabase instance running?
        </H3>
      </div>
    );
  }

  if (!controller) {
    return (
      <div className="w-full px-8">
        <H3 className="px-12 py-2 text-muted-foreground">Loading...</H3>
      </div>
    );
  }

  return (
    /*
      `NavigationProvider` is here for the bubble menu's `EndNoteSelector`,
      which reads `{ uuid, updatePanel, fetchEndNote }` off `useNavigation()`.

      Needed for *use*, not for render: `NavigationContext` has a full default
      object, so every selector opens without it — verified in a browser, both
      ways. What the defaults give are `uuid: ''`, so an endnote search would
      look in an empty work, and `fetchEndNote`/`updatePanel` that throw "Not
      implemented" when a result is chosen.

      The work uuid is only known once the work resolves, which is why this is
      not in the route. `EndNoteSelector` also reads `EditorProvider`'s
      context, whose defaults degrade silently rather than throw — that one is
      slice 5's concern, since the stack replaces that provider.
    */
    <NavigationProvider
      uuid={controller.work.workUuid}
      initialToh={toh as TohokuCatalogEntry}
    >
      <div className="h-[calc(100dvh-5rem)] w-full">
        <PassageStack
          controller={controller}
          className="h-full"
          overscan={overscan}
        />
        <PerfHUD controller={controller} />
      </div>
    </NavigationProvider>
  );
};
