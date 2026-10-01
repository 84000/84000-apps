import { PassageLoader } from '@eightyfourthousand/lib-doc-model';

import { PassageStackController } from './PassageStackController';
import { build, flush, seeds } from './stack-controller.fixture';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

describe('PassageStackController hydration signal', () => {
  it('reports a window load as in flight while it runs', async () => {
    const all = seeds(5);
    // Definite assignment: the executor runs synchronously, but TypeScript
    // cannot see that and narrows the binding to `never` otherwise.
    let release!: () => void;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const work = createStackWorkDocument({
      workUuid: 'work-1',
      loader: new PassageLoader({
        sources: [
          {
            name: 'slow',
            loadPassages: async (_workUuid, uuids) => {
              await held;
              return uuids.map((uuid) => ({
                uuid,
                content: all.find((s) => s.meta.uuid === uuid)?.content ?? [],
              }));
            },
          },
        ],
        buffer: 0,
      }),
    });
    work.seedSpine(all.map((entry) => entry.meta));
    const controller = new PassageStackController({ work });

    expect(controller.isHydrating()).toBe(false);

    controller.setVisibleRange({ start: 0, end: 5 });
    await flush();
    // Between issuing a scroll and the content landing the page is perfectly
    // still; a settled scroll needs to tell that apart from being finished.
    expect(controller.isHydrating()).toBe(true);

    release();
    await flush();
    await flush();

    expect(controller.isHydrating()).toBe(false);
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
