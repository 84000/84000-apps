import {
  PassageLoader,
  type PassageSnapshot,
  type PassageSource,
} from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { createStackWorkDocument } from './stack-work';
import type { StackPassageSeed } from './types';

/** One plain-text translation passage. */
export const seed = (
  uuid: string,
  label: string,
  text: string,
): StackPassageSeed => ({
  meta: { uuid, label, type: 'translation' },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  charCount: text.length,
});

/** `count` numbered passages, `p0` onward. */
export const seeds = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    seed(`p${i}`, `${i + 1}`, `passage ${i} text`),
  );

/** Serves the seeds, so hydration goes through the real windowed path. */
export const source = (all: StackPassageSeed[]): PassageSource => {
  const byUuid = new Map(all.map((entry) => [entry.meta.uuid, entry]));
  return {
    name: 'test',
    loadPassages: async (_workUuid, uuids) =>
      uuids.flatMap((uuid): PassageSnapshot[] => {
        const entry = byUuid.get(uuid);
        return entry ? [{ uuid, content: entry.content }] : [];
      }),
  };
};

/** A windowed work over `count` passages, plus its controller. */
export const build = (count = 5, buffer = 0) => {
  const all = seeds(count);
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source(all)], buffer }),
  });
  work.seedSpine(all.map((entry) => entry.meta));
  const controller = new PassageStackController({
    work,
    charCounts: all.map((entry) => [entry.meta.uuid, entry.charCount] as const),
  });
  return { work, controller, all };
};

/** Let the controller's in-flight hydration settle. */
export const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A hydrated work, windowed over all of it, plus its controller. */
export const hydrated = async (count = 5) => {
  const built = build(count);
  built.controller.setVisibleRange({ start: 0, end: count });
  await flush();
  return built;
};
