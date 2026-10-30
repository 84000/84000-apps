import { ySyncPluginKey } from '@tiptap/y-tiptap';
import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { StackController } from './StackController';
import { createStackWorkDocument } from './stack-work';
import { flush, seeds, source } from './stack-controller.fixture';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const hydratedWork = async () => {
  const all = seeds(2);
  const work = createStackWorkDocument({
    workUuid: 'work-1',
    loader: new PassageLoader({ sources: [source(all)] }),
  });
  work.seedSpine(all.map((entry) => entry.meta));
  return work;
};

/** Whether typing in a passage's editor would reach its undo history. */
const tracksTyping = (
  work: ReturnType<typeof createStackWorkDocument>,
  uuid: string,
) => !!work.store.peek(uuid)?.undoManager.trackedOrigins.has(ySyncPluginKey);

describe('StackController without the editing layer', () => {
  it('is read-only, whatever it is asked', async () => {
    const work = await hydratedWork();
    const view = new StackController({ work, readOnly: false });
    expect(view.isReadOnly()).toBe(true);

    view.setReadOnly(false);
    expect(view.isReadOnly()).toBe(true);
    expect(view.getEditing()).toBeNull();
    view.destroy();
  });

  it('mounts no editor', async () => {
    const work = await hydratedWork();
    const view = new StackController({ work });
    view.setVisibleRange({ start: 0, end: 2 });
    await flush();

    expect(() => view.buildEditorExtensions('p0')).toThrow(/read-only/);
    expect(view.isLive('p0')).toBe(false);
    view.destroy();
  });

  it("leaves the editor's typing untracked", async () => {
    const work = await hydratedWork();
    const view = new StackController({ work });
    view.setVisibleRange({ start: 0, end: 2 });
    await flush();

    expect(tracksTyping(work, 'p0')).toBe(false);
    view.destroy();
  });
});

describe('PassageStackController', () => {
  it('edits, and can switch to reading and back', async () => {
    const work = await hydratedWork();
    const view = new PassageStackController({ work });
    expect(view.isReadOnly()).toBe(false);

    view.setReadOnly(true);
    expect(view.isReadOnly()).toBe(true);
    view.setReadOnly(false);
    expect(view.isReadOnly()).toBe(false);
    view.destroy();
  });

  it("tracks the editor's typing in passages hydrated before and after it", async () => {
    const work = await hydratedWork();
    const reader = new StackController({ work, windowKey: 'reader' });
    reader.setVisibleRange({ start: 0, end: 1 });
    await flush();

    const view = new PassageStackController({ work });
    view.setVisibleRange({ start: 0, end: 2 });
    await flush();

    expect(tracksTyping(work, 'p0')).toBe(true);
    expect(tracksTyping(work, 'p1')).toBe(true);
    reader.destroy();
    view.destroy();
  });
});
