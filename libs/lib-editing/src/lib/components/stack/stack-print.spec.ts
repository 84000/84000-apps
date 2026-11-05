import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { StackController } from './StackController';
import { seeds, source } from './stack-controller.fixture';
import { readStackForPrint } from './stack-print';
import { RowFeed, type RowMeta, type RowPages } from './spine-feed';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts: the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/** Pages over `all`, read the way the API reads them. */
const pagesOver = (all: RowMeta[]): RowPages => ({
  metas: async ({ cursor, limit, direction }) => {
    const at = cursor ? all.findIndex((meta) => meta.uuid === cursor) : -1;
    let from: number;
    let to: number;
    if (direction === 'AROUND') {
      from = Math.max(0, at - Math.floor(limit / 2));
      to = Math.min(all.length, from + limit);
    } else if (direction === 'BACKWARD') {
      to = at;
      from = Math.max(0, to - limit);
    } else {
      from = at + 1;
      to = Math.min(all.length, from + limit);
    }
    return {
      metas: all.slice(from, to),
      prevCursor: from > 0 ? all[from].uuid : undefined,
      nextCursor: to < all.length ? all[to - 1].uuid : undefined,
      hasMoreBefore: from > 0,
      hasMoreAfter: to < all.length,
    };
  },
  content: async () => null,
});

/** A reader's view over `count` passages, its spine holding the first page. */
const build = async (
  count: number,
  {
    missing = [] as string[],
    openAt,
  }: { missing?: string[]; openAt?: string } = {},
) => {
  const all = seeds(count);
  const served = all.filter((entry) => !missing.includes(entry.meta.uuid));
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source(served)], buffer: 0 }),
  });
  const metas = all.map((entry) => ({ ...entry.meta }) as RowMeta);
  const feed = new RowFeed(work, pagesOver(metas));
  if (openAt) await feed.reveal(openAt);
  else await feed.seed();
  const controller = new StackController({
    work,
    spineFeed: feed,
    readOnly: true,
  });
  return { work, feed, controller, all };
};

describe('readStackForPrint', () => {
  it('reads every row of the run, growing it to the end', async () => {
    const { feed, controller, all } = await build(450);
    expect(controller.getOrder()).toHaveLength(100);

    const rows = await readStackForPrint(controller);

    expect(feed.hasMore).toBe(false);
    expect(rows?.map((row) => row.meta.uuid)).toEqual(
      all.map((entry) => entry.meta.uuid),
    );
    expect(rows?.[449].html).toContain('passage 449 text');
  });

  it('grows a run opened part way back to its start, without replacing it', async () => {
    const { feed, controller } = await build(450, { openAt: 'p300' });
    const before = controller.getOrder();
    expect(feed.hasMoreBefore).toBe(true);

    const rows = await readStackForPrint(controller);

    expect(feed.hasMoreBefore).toBe(false);
    expect(rows?.[0].meta.uuid).toBe('p0');
    const after = controller.getOrder();
    expect(after.filter((uuid) => before.includes(uuid))).toEqual(before);
  });

  it('releases what it reads as it goes', async () => {
    const { work, controller } = await build(1000);
    const held = work.store.size;

    await readStackForPrint(controller);

    expect(work.store.size - held).toBeLessThanOrEqual(300);
  });

  it('reports progress up to every row', async () => {
    const { controller } = await build(450);
    const progress: { loaded: number; total: number }[] = [];

    await readStackForPrint(controller, {
      onProgress: (step) => progress.push(step),
    });

    progress.forEach((step) =>
      expect(step.loaded).toBeLessThanOrEqual(step.total),
    );
    expect(progress[progress.length - 1]).toEqual({ loaded: 450, total: 450 });
  });

  it('is null when cancelled part way', async () => {
    const { controller } = await build(450);
    const abort = new AbortController();

    const rows = await readStackForPrint(controller, {
      signal: abort.signal,
      onProgress: ({ loaded }) => loaded > 0 && abort.abort(),
    });

    expect(rows).toBeNull();
  });

  it('is null when cancelled', async () => {
    const { controller } = await build(450);
    const abort = new AbortController();
    abort.abort();

    expect(
      await readStackForPrint(controller, { signal: abort.signal }),
    ).toBeNull();
  });

  it('is null when a row cannot be read', async () => {
    const { controller } = await build(450, { missing: ['p250'] });

    expect(await readStackForPrint(controller)).toBeNull();
  });

  it('keeps no HTML of the rows it released', async () => {
    const { work, controller } = await build(450);

    await readStackForPrint(controller);

    const released = controller
      .getOrder()
      .filter((uuid) => !work.store.has(uuid));
    expect(released.length).toBeGreaterThan(0);
    released.forEach((uuid) =>
      expect(controller.getStaticHTML(uuid)).toBeNull(),
    );
  });
});
