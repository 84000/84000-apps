/**
 * Acceptance tests for DEV-837 item 4a, AC5: a tab's stack keeps its own
 * seeded passages in memory while it reports the rows it draws, even when the
 * reported range runs one row past the tab's current order.
 *
 * Written from the spec, not the implementation. It drives the exported
 * controllers over a work document the way `StackReaderProvider` seeds one:
 * documents created up front, a loader that records every read.
 */
import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { StackController } from './StackController';
import { flush } from './stack-controller.fixture';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

type Meta = { uuid: string; label: string; type: string; toh?: string };

const text = (uuid: string) => [
  { type: 'paragraph', content: [{ type: 'text', text: `${uuid} text` }] },
];

/**
 * A work with a translation and an endnotes run, both seeded, and a loader
 * that answers (and records) anything the stacks have to read.
 */
const seededWork = (unseeded: string[] = []) => {
  const metas: Meta[] = [
    { uuid: 't0', label: '1', type: 'translation' },
    { uuid: 't1', label: '2', type: 'translation' },
    { uuid: 'n0', label: 'n.1', type: 'endnotes' },
    { uuid: 'n1', label: 'n.2', type: 'endnotes', toh: 'toh2' },
    { uuid: 'n2', label: 'n.3', type: 'endnotes' },
    { uuid: 'n3', label: 'n.4', type: 'endnotes' },
  ];
  const loaded: string[][] = [];
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({
      sources: [
        {
          name: 'recording',
          loadPassages: async (_workUuid, uuids) => {
            loaded.push([...uuids]);
            return uuids.map((uuid) => ({ uuid, content: text(uuid) }));
          },
        },
      ],
      buffer: 0,
    }),
  });
  work.seedSpine(metas as Parameters<typeof work.seedSpine>[0]);
  // What the provider does with a server's content: create the documents.
  metas
    .filter(({ uuid }) => !unseeded.includes(uuid))
    .forEach(({ uuid }) => work.store.create(uuid, text(uuid) as never));
  return { work, loaded, metas };
};

describe.each([
  ['StackController', StackController],
  ['PassageStackController', PassageStackController],
])('%s over seeded passages (AC5)', (_name, Controller) => {
  it('does not release or re-read its seeded passages when the range runs one past the order', async () => {
    const { work, loaded } = seededWork();
    const endnotes = new Controller({ work, tab: 'endnotes' });
    // For the selected Toh, n.2 belongs to another text and is not drawn.
    endnotes.setActiveToh('toh1');
    const order = endnotes.getOrder();
    expect(order).toEqual(['n0', 'n2', 'n3']);

    // A virtualizer drawing every row, and the footer's one past them.
    endnotes.setVisibleRange({ start: 0, end: order.length + 1 });
    await flush();
    await flush();

    for (const uuid of order) expect(work.store.has(uuid)).toBe(true);
    expect(loaded).toEqual([]);
    endnotes.destroy();
  });

  it('keeps the seeded passages of a passage hidden for the selected Toh, and reads nothing', async () => {
    const { work, loaded } = seededWork();
    const endnotes = new Controller({ work, tab: 'endnotes' });
    endnotes.setVisibleRange({ start: 0, end: 4 });
    await flush();
    expect(['n0', 'n1', 'n2', 'n3'].every((uuid) => work.store.has(uuid))).toBe(
      true,
    );

    // The reader selects the Toh that hides n.2: three rows are drawn. Then the
    // rows are reported once more, one past what is drawn.
    endnotes.setActiveToh('toh1');
    expect(endnotes.getOrder()).toHaveLength(3);
    endnotes.setVisibleRange({ start: 0, end: 3 });
    await flush();
    endnotes.setVisibleRange({ start: 0, end: 4 });
    await flush();
    await flush();

    for (const uuid of ['n0', 'n1', 'n2', 'n3']) {
      expect(work.store.has(uuid)).toBe(true);
    }
    expect(loaded).toEqual([]);
    endnotes.destroy();
  });

  it('keeps its seeded passages when the range runs one past an unscoped order', async () => {
    const { work, loaded } = seededWork();
    const translation = new Controller({ work, tab: 'translation' });
    // Not scoped, so the order is the whole run (two rows); 3 is one past it.
    translation.setVisibleRange({ start: 0, end: 3 });
    await flush();
    await flush();

    expect(work.store.has('t0')).toBe(true);
    expect(work.store.has('t1')).toBe(true);
    expect(loaded).toEqual([]);
    translation.destroy();
  });

  it('does not touch another tab’s seeded passages', async () => {
    const { work, loaded } = seededWork();
    const translation = new Controller({ work, tab: 'translation' });
    const endnotes = new Controller({ work, tab: 'endnotes' });
    endnotes.setActiveToh('toh1');
    translation.setVisibleRange({ start: 0, end: 3 });
    endnotes.setVisibleRange({ start: 0, end: endnotes.getOrder().length + 1 });
    await flush();
    await flush();

    for (const uuid of ['t0', 't1', 'n0', 'n2', 'n3']) {
      expect(work.store.has(uuid)).toBe(true);
    }
    expect(loaded).toEqual([]);
    translation.destroy();
    endnotes.destroy();
  });

  it('still reads a passage it was not seeded with, and only that one', async () => {
    const { work, loaded } = seededWork(['n3']);
    const endnotes = new Controller({ work, tab: 'endnotes' });
    endnotes.setVisibleRange({ start: 0, end: 4 });
    await flush();
    await flush();

    expect(loaded.flat()).toEqual(['n3']);
    expect(work.store.has('n3')).toBe(true);
    for (const uuid of ['n0', 'n1', 'n2']) {
      expect(work.store.has(uuid)).toBe(true);
    }
    endnotes.destroy();
  });
});
