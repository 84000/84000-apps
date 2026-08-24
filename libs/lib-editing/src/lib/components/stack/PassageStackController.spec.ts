import { ySyncPluginKey } from '@tiptap/y-tiptap';
import type { XmlElement, XmlText } from 'yjs';
import {
  PassageLoader,
  type PassageSnapshot,
  type PassageSource,
  type WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { createStackWorkDocument } from './stack-work';
import type { StackPassageSeed } from './types';

// Building the stack schema instantiates every editor extension, and Mention's
// suggestion list imports the `shared` barrel, which re-exports `redirects.ts`
// — a client entry point reaching `data-access/ssr`, hence `next/server` and
// `resend`. `lib-search`'s client barrel leaks the same way. Neither is
// something this module does, so stub the two server leaves rather than work
// around the schema. Recorded in HANDOFF.md as a bundle-size follow-up.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const seed = (uuid: string, label: string, text: string): StackPassageSeed => ({
  meta: { uuid, label, type: 'translation' },
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
  charCount: text.length,
});

const seeds = (count: number) =>
  Array.from({ length: count }, (_, i) =>
    seed(`p${i}`, `${i + 1}`, `passage ${i} text`),
  );

/** Serves the seeds, so hydration goes through the real windowed path. */
const source = (all: StackPassageSeed[]): PassageSource => {
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

const build = (count = 5, buffer = 0) => {
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
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A hydrated work, windowed over all of it, plus its controller. */
const hydrated = async (count = 5) => {
  const built = build(count);
  built.controller.setVisibleRange({ start: 0, end: count });
  await flush();
  return built;
};

/**
 * A text edit as a mounted editor would make it — written into the paragraph's
 * own `XmlText` under the y-sync origin, which is what makes the passage's
 * UndoManager treat it as the user's typing rather than a structural rewrite.
 */
const typeInto = (work: WorkDocument, uuid: string, text: string) => {
  const doc = work.store.peek(uuid);
  if (!doc) throw new Error(`passage ${uuid} is not hydrated`);
  doc.doc.transact(() => {
    const paragraph = doc.content.get(0) as XmlElement;
    (paragraph.get(0) as XmlText).insert(0, text);
  }, ySyncPluginKey);
};

describe('PassageStackController spine view', () => {
  it('reports the spine order and invalidates it after a structural op', () => {
    const { work, controller } = build(3);
    expect(controller.getOrder()).toEqual(['p0', 'p1', 'p2']);

    work.remove(['p1']);
    expect(controller.getOrder()).toEqual(['p0', 'p2']);
  });

  it('reads labels from the spine, including after renumbering', () => {
    const { work, controller } = build(3);
    work.remove(['p0']);

    expect(controller.getMeta('p1')?.label).toBe('1');
    expect(controller.getMeta('p2')?.label).toBe('2');
  });

  it('estimates a row height for a passage it has never hydrated', () => {
    const { controller } = build(3);
    expect(controller.isHydrated('p2')).toBe(false);
    expect(controller.estimateHeight('p2')).toBeGreaterThan(0);
  });
});

describe('PassageStackController hydration', () => {
  it('has no static HTML for a passage outside the window', () => {
    const { controller } = build(5);
    expect(controller.getStaticHTML('p3')).toBeNull();
  });

  it('renders static HTML once the window reaches a passage', async () => {
    const { controller } = build(5);
    controller.setVisibleRange({ start: 0, end: 2 });
    await flush();

    expect(controller.getStaticHTML('p0')).toContain('passage 0 text');
  });

  it('releases documents the window has left behind', async () => {
    const { work, controller } = build(6);
    controller.setVisibleRange({ start: 0, end: 2 });
    await flush();
    expect(work.store.has('p0')).toBe(true);

    controller.setVisibleRange({ start: 4, end: 6 });
    await flush();

    expect(work.store.has('p0')).toBe(false);
    expect(work.store.has('p4')).toBe(true);
  });

  it('keeps a focused passage hydrated after scrolling away from it', async () => {
    const { work, controller } = build(8);
    controller.setVisibleRange({ start: 0, end: 2 });
    await flush();

    controller.focusPassage('p0');
    await flush();

    controller.setVisibleRange({ start: 5, end: 8 });
    await flush();

    // Releasing p0 here would tear the document out from under its editor.
    expect(work.store.has('p0')).toBe(true);
  });
});

describe('PassageStackController undo bookkeeping', () => {
  it('records a passage text edit in the work command log', async () => {
    const { work, controller } = await hydrated(3);
    expect(work.log.depth).toBe(0);

    typeInto(work, 'p1', 'hello ');

    // Nothing in the doc model calls recordTextEdit; the controller's wiring
    // is what puts typing into the same history as split and merge.
    expect(work.log.depth).toBe(1);
    expect(controller.undoDepth()).toBe(1);
  });

  it('interleaves text and structural entries in one history', async () => {
    const { work, controller } = await hydrated(3);
    typeInto(work, 'p0', 'edited ');
    work.merge('p1');

    expect(controller.undoDepth()).toBe(2);

    expect(controller.undo()).toBe(true);
    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2']);
  });

  // Regression: structural undo used to restore a passage by clearing and
  // rebuilding its whole document, which destroyed the Yjs items the passage's
  // own UndoManager still pointed at. The text undo underneath then applied to
  // nothing — Yjs reported success, the history entry was consumed, and the
  // keystroke vanished. `PassageDoc.replaceContent` now diffs instead, so the
  // items either side of the change keep their identity.
  it('restores a text edit undone beneath a structural undo', async () => {
    const { work, controller } = await hydrated(3);
    typeInto(work, 'p0', 'edited ');
    work.merge('p1');
    expect(work.store.ensure('p0').text).toBe(
      'edited passage 0 textpassage 1 text',
    );

    expect(controller.undo()).toBe(true); // the merge
    expect(work.spine.uuids()).toEqual(['p0', 'p1', 'p2']);
    expect(work.store.ensure('p0').text).toBe('edited passage 0 text');

    expect(controller.undo()).toBe(true); // the typing beneath it
    expect(work.store.ensure('p0').text).toBe('passage 0 text');
    expect(work.log.depth).toBe(0);
  });

  it('does not re-record an edit while redoing it', async () => {
    const { work, controller } = await hydrated(3);
    typeInto(work, 'p0', 'edited ');

    controller.undo();
    controller.redo();

    // A redo pushes the item back onto the passage UndoManager's undo stack,
    // which fires the same event a fresh edit does. Recording that would
    // clear the redo branch and leave the log one entry too deep.
    expect(controller.undoDepth()).toBe(1);
    expect(work.store.ensure('p0').text).toBe('edited passage 0 text');
  });

  it('drops text history for a passage whose document was released', async () => {
    const { work, controller } = build(6);
    controller.setVisibleRange({ start: 0, end: 2 });
    await flush();

    typeInto(work, 'p0', 'edited ');
    expect(controller.undoDepth()).toBe(1);
    work.store.peek('p0')?.markSynced();

    controller.setVisibleRange({ start: 4, end: 6 });
    await flush();

    expect(work.store.has('p0')).toBe(false);
    expect(controller.undoDepth()).toBe(0);
  });
});

describe('PassageStackController structural ops', () => {
  it('merges a passage into the one before it', async () => {
    const { work, controller } = await hydrated(3);
    expect(controller.mergeWithPrevious('p1')).toBe(true);

    expect(controller.getOrder()).toEqual(['p0', 'p2']);
    expect(work.store.ensure('p0').text).toBe('passage 0 textpassage 1 text');
  });

  it('refuses to merge the first passage', async () => {
    const { controller } = await hydrated(3);
    expect(controller.mergeWithPrevious('p0')).toBe(false);
    expect(controller.getOrder()).toEqual(['p0', 'p1', 'p2']);
  });

  it('does nothing when splitting a passage with no mounted editor', async () => {
    const { controller } = await hydrated(3);
    // Split reads the caret from the editor, so an unmounted passage has no
    // position to split at.
    expect(controller.splitAtSelection('p1')).toBe(false);
    expect(controller.getOrder()).toEqual(['p0', 'p1', 'p2']);
  });
});
