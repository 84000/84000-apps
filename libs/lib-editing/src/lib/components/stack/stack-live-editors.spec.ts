import { hydrated } from './stack-controller.fixture';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

describe('PassageStackController focused editor', () => {
  /** Enough of an Editor for the controller's focus bookkeeping. */
  const fakeEditor = () =>
    ({
      isEditable: true,
      setEditable: () => undefined,
      commands: {
        focus: () => true,
        insertContent: () => true,
      },
    }) as never;

  // Regression: the shared bubble menu binds to `getFocusedEditor()`, which is
  // null until an editor registers. Focusing a passage renders its row as an
  // editor, the editor mounts and registers — and without a notify there the
  // menu was still holding the null it had been rendered with, so it never
  // appeared. Found in a browser: the menu was absent while the controller was
  // correctly bound.
  it('notifies when the focused passage registers its editor', async () => {
    const { controller } = await hydrated(3);
    const seen: number[] = [];
    controller.subscribe(() => seen.push(controller.getVersion()));

    controller.focusPassage('p1');
    seen.length = 0;

    controller.registerEditor('p1', fakeEditor());

    expect(seen.length).toBeGreaterThan(0);
    expect(controller.getFocusedEditor()).not.toBeNull();
  });

  it('notifies when focus moves between two already-live passages', async () => {
    const { controller } = await hydrated(5);
    controller.focusPassage('p2');
    controller.registerEditor('p2', fakeEditor());
    controller.registerEditor('p3', fakeEditor());

    const seen: number[] = [];
    controller.subscribe(() => seen.push(controller.getVersion()));
    controller.notifyFocused('p3');

    // `recenterLive` alone would not report this when both are already live.
    expect(seen.length).toBeGreaterThan(0);
    expect(controller.getFocusedUuid()).toBe('p3');
  });

  it('lets go of the editor when the focused passage unmounts', async () => {
    const { controller } = await hydrated(3);
    controller.focusPassage('p1');
    controller.registerEditor('p1', fakeEditor());
    expect(controller.getFocusedEditor()).not.toBeNull();

    controller.unregisterEditor('p1');
    expect(controller.getFocusedEditor()).toBeNull();
  });
});
