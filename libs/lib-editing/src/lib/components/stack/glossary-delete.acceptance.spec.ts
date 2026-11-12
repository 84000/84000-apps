/**
 * Acceptance tests for DEV-883 delete criterion 9, the work half: confirming
 * a delete removes the entry, its row, and its instances in the passages that
 * are loaded; nothing else changes. (Cancelling never reaches this function,
 * and is checked on the menu's dialog.)
 *
 * Written from the spec (TASK.md, CONTRACT.md), not the implementation. Only
 * data-access is faked, at the module boundary.
 */
import type { JSONContent } from '@tiptap/core';
import type { WorkDocument } from '@eightyfourthousand/lib-doc-model';

import { deleteGlossaryRow } from './glossary-delete';
import { loadGlossaryWork, type GlossaryWork } from './glossary-work';
import {
  glossaryFake,
  WORK,
  type GlossaryFake,
  type GlossaryItem,
  type PageArgs,
} from './glossary-work.fixture';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts: building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

let fake: GlossaryFake;
const mockPage = (args: PageArgs) => fake.page(args);
const mockEntries = (args: { workUuid: string; uuids: readonly string[] }) =>
  fake.entries(args);
const mockDelete = (args: { uuid: string }) => fake.remove(args);

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getWorkGlossaryTermsPage: (args: PageArgs) => mockPage(args),
  getGlossaryEntries: (args: { workUuid: string; uuids: readonly string[] }) =>
    mockEntries(args),
  deleteGlossaryEntry: (args: { uuid: string }) => mockDelete(args),
  createBrowserClient: () => ({}),
}));

const ITEMS: GlossaryItem[] = [
  { uuid: 'g1', termNumber: 1, definition: '<p>First.</p>' },
  { uuid: 'g2', termNumber: 2, definition: '<p>Second.</p>' },
  { uuid: 'g3', termNumber: 3, definition: '<p>Third.</p>' },
];

const loaded = async (): Promise<GlossaryWork> => {
  fake = glossaryFake(ITEMS);
  const glossary = await loadGlossaryWork({
    workUuid: WORK,
    client: fake.client,
    graphql: {} as never,
  });
  if (!glossary) throw new Error('the glossary did not load');
  await glossary.work.hydrateWindow({ start: 0, end: ITEMS.length });
  return glossary;
};

const instance = (text: string, glossary: string, uuid: string) => ({
  type: 'text',
  text,
  marks: [{ type: 'glossaryInstance', attrs: { uuid, glossary } }],
});
const plainRun = (text: string) => ({ type: 'text', text });

/**
 * A work of translation passages whose paragraphs hold glossary instances:
 * p1 cites g2 and g1, p2 cites g2 twice, p3 cites only g1, p4 cites nothing.
 */
const passagesWork = (): WorkDocument => {
  const work = createStackWorkDocument({ workUuid: WORK });
  const metas = ['p1', 'p2', 'p3', 'p4'].map((uuid, i) => ({
    uuid,
    label: `1.${i + 1}`,
    type: 'translation' as const,
  }));
  work.seedSpine(metas);
  const paragraphs: Record<string, JSONContent[]> = {
    p1: [
      plainRun('The '),
      instance('karma', 'g2', 'm1'),
      plainRun(' and '),
      instance('dharma', 'g1', 'm2'),
      plainRun(' end.'),
    ],
    p2: [
      instance('karma', 'g2', 'm3'),
      plainRun(' then '),
      instance('karma', 'g2', 'm4'),
    ],
    p3: [plainRun('Only '), instance('dharma', 'g1', 'm5')],
    p4: [plainRun('Nothing cited here.')],
  };
  Object.entries(paragraphs).forEach(([uuid, content]) =>
    work.store.create(uuid, [{ type: 'paragraph', content }]),
  );
  return work;
};

/** The glossary instances in a passage: their text and the entry they cite. */
const instancesIn = (work: WorkDocument, uuid: string) => {
  const found: { text: string; glossary: string }[] = [];
  work.store
    .peek(uuid)
    ?.toNode()
    .descendants((node) => {
      node.marks.forEach((mark) => {
        if (mark.type.name === 'glossaryInstance') {
          found.push({
            text: node.text ?? '',
            glossary: mark.attrs.glossary as string,
          });
        }
      });
    });
  return found;
};

const textIn = (work: WorkDocument, uuid: string) =>
  work.store.peek(uuid)?.toNode().textContent;

describe('criterion 9: confirming removes the entry, its row and its instances', () => {
  it('criterion 9: deletes the entry through data-access, for this work', async () => {
    const glossary = await loaded();

    const result = await deleteGlossaryRow({
      glossary,
      uuid: 'g2',
      client: fake.client,
      passages: [passagesWork()],
    });

    expect(result).toEqual({ deleted: true });
    expect(fake.remove).toHaveBeenCalledTimes(1);
    expect(fake.remove).toHaveBeenCalledWith(
      expect.objectContaining({
        client: fake.client,
        workUuid: WORK,
        uuid: 'g2',
      }),
    );
    expect(fake.stored.has('g2')).toBe(false);
  });

  it('criterion 9: the row leaves the glossary, the others stay in order', async () => {
    const glossary = await loaded();

    await deleteGlossaryRow({
      glossary,
      uuid: 'g2',
      client: fake.client,
      passages: [],
    });

    expect(glossary.work.spine.entries().map((row) => row.uuid)).toEqual([
      'g1',
      'g3',
    ]);
    expect(glossary.work.spine.entries().map((row) => row.label)).toEqual([
      'g.1',
      'g.3',
    ]);
    expect(glossary.work.store.peek('g2')).toBeUndefined();
    expect(glossary.entries.has('g2')).toBe(false);
    expect(glossary.entries.has('g1')).toBe(true);
    expect(glossary.work.store.peek('g1')?.toNode().textContent).toBe('First.');
  });

  it('criterion 9: removes the entry’s instances in the loaded passages, keeping their text', async () => {
    const glossary = await loaded();
    const passages = passagesWork();
    const before = ['p1', 'p2', 'p3', 'p4'].map((uuid) =>
      textIn(passages, uuid),
    );

    await deleteGlossaryRow({
      glossary,
      uuid: 'g2',
      client: fake.client,
      passages: [passages],
    });

    expect(instancesIn(passages, 'p1')).toEqual([
      { text: 'dharma', glossary: 'g1' },
    ]);
    expect(instancesIn(passages, 'p2')).toEqual([]);
    // Another entry’s instances are not touched.
    expect(instancesIn(passages, 'p3')).toEqual([
      { text: 'dharma', glossary: 'g1' },
    ]);
    expect(instancesIn(passages, 'p4')).toEqual([]);
    // What was written stays written.
    expect(
      ['p1', 'p2', 'p3', 'p4'].map((uuid) => textIn(passages, uuid)),
    ).toEqual(before);
  });

  it('criterion 9: removes the instances from every passages work it is given', async () => {
    const glossary = await loaded();
    const first = passagesWork();
    const second = passagesWork();

    await deleteGlossaryRow({
      glossary,
      uuid: 'g2',
      client: fake.client,
      passages: [first, second],
    });

    [first, second].forEach((work) =>
      expect(instancesIn(work, 'p2')).toEqual([]),
    );
  });

  it('criterion 9: a delete the server refuses changes nothing', async () => {
    const glossary = await loaded();
    const passages = passagesWork();
    fake.remove.mockResolvedValueOnce({
      success: false,
      reason: 'failed',
      error: 'connection lost',
      outcomeUnknown: false,
    });

    const result = await deleteGlossaryRow({
      glossary,
      uuid: 'g2',
      client: fake.client,
      passages: [passages],
    });

    expect(result.deleted).toBe(false);
    expect(typeof (result as { error: string }).error).toBe('string');
    expect(glossary.work.spine.entries().map((row) => row.uuid)).toEqual([
      'g1',
      'g2',
      'g3',
    ]);
    expect(glossary.entries.has('g2')).toBe(true);
    expect(instancesIn(passages, 'p1')).toHaveLength(2);
    expect(instancesIn(passages, 'p2')).toHaveLength(2);
  });
});
