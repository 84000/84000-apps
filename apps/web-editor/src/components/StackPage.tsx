'use client';

import { H3 } from '@eightyfourthousand/design-system';
import {
  AnnotationDTO,
  Passage,
  annotationsFromDTO,
  createBrowserClient,
  getAnnotationsByPassageUuids,
  passageFromDTO,
  PassageDTO,
} from '@eightyfourthousand/data-access';
import {
  PassageStack,
  PassageStackController,
  PerfHUD,
  StackPassageSeed,
  stackSeedFromPassage,
} from '@eightyfourthousand/lib-editing';
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

export const StackPage = ({
  toh,
  repeat = 1,
  overscan,
}: {
  toh: string;
  repeat?: number;
  overscan?: number;
}) => {
  const [seeds, setSeeds] = useState<StackPassageSeed[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setSeeds(null);
    setFailed(false);

    loadPassages(toh).then((passages) => {
      if (cancelled) return;
      if (!passages.length) {
        setFailed(true);
        return;
      }
      setSeeds(repeatPassages(passages, repeat).map(stackSeedFromPassage));
    });

    return () => {
      cancelled = true;
    };
  }, [toh, repeat]);

  const controller = useMemo(
    () => (seeds ? new PassageStackController(seeds) : null),
    [seeds],
  );

  useEffect(() => {
    // Debug handle for the spike: poke the spine from the console.
    (window as unknown as Record<string, unknown>)['__stackController'] =
      controller ?? undefined;
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
    <div className="h-[calc(100dvh-5rem)] w-full">
      <PassageStack
        controller={controller}
        className="h-full"
        overscan={overscan}
      />
      <PerfHUD controller={controller} />
    </div>
  );
};
