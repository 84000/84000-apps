import { Editor } from '@tiptap/core';

import type { PassageStackController } from './PassageStackController';
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
      view: { focus: () => undefined },
    }) as never;

  /** A real editor on the controller's own extensions, mounted in the page. */
  const mountEditor = (controller: PassageStackController, uuid: string) => {
    const element = document.createElement('div');
    document.body.append(element);
    return new Editor({
      element,
      extensions: controller.buildEditorExtensions(uuid),
    });
  };

  const keydown = (key: string, init: KeyboardEventInit = {}) =>
    new KeyboardEvent('keydown', { key, ...init });

  const insertText = (data: string) =>
    new InputEvent('beforeinput', { inputType: 'insertText', data });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  // Regression: typing straight after clicking a static row dropped keys.
  // Registering stopped the buffer, but DOM focus only moved a frame later, so
  // a key in that frame landed on the static row.
  it('has DOM focus on the editor as soon as it registers', async () => {
    const { controller } = await hydrated(3);
    controller.focusPassage('p1');
    const editor = mountEditor(controller, 'p1');

    controller.registerEditor('p1', editor);

    expect(editor.view.hasFocus()).toBe(true);
    editor.destroy();
  });

  // Regression: inserted text arrives as `beforeinput` with no keydown.
  it('replays keyed and inserted text typed before the editor mounted', async () => {
    const { controller } = await hydrated(3);
    controller.focusPassage('p1');

    expect(controller.bufferTyping(keydown('z'))).toBe(true);
    expect(controller.bufferTyping(insertText('qx'))).toBe(true);

    const editor = mountEditor(controller, 'p1');
    controller.registerEditor('p1', editor);

    expect(editor.getText()).toBe('zqxpassage 1 text');
    editor.destroy();
  });

  // Regression: the mobile layout mounts a second stack on the same controller,
  // so every buffered character was taken twice and typed twice.
  it('takes an event once however many stacks listen for it', async () => {
    const { controller } = await hydrated(3);
    controller.focusPassage('p1');
    // Two stacks' listeners, as `PassageStack` binds them.
    const listeners = [0, 1].map(() => (event: KeyboardEvent) => {
      if (controller.bufferTyping(event)) event.preventDefault();
    });
    listeners.forEach((l) => document.addEventListener('keydown', l, true));

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'z', cancelable: true }),
    );
    listeners.forEach((l) => document.removeEventListener('keydown', l, true));

    const editor = mountEditor(controller, 'p1');
    controller.registerEditor('p1', editor);
    expect(editor.getText()).toBe('zpassage 1 text');
    editor.destroy();
  });

  it('leaves shortcuts, non-text keys and composition alone', async () => {
    const { controller } = await hydrated(3);
    controller.focusPassage('p1');

    expect(controller.bufferTyping(keydown('z', { metaKey: true }))).toBe(
      false,
    );
    expect(controller.bufferTyping(keydown('Enter'))).toBe(false);
    expect(
      controller.bufferTyping(
        new InputEvent('beforeinput', {
          inputType: 'insertCompositionText',
          data: 'z',
        }),
      ),
    ).toBe(false);
  });

  it('takes no typing once nothing is waiting to mount', async () => {
    const { controller } = await hydrated(3);
    expect(controller.bufferTyping(keydown('z'))).toBe(false);

    controller.focusPassage('p1');
    controller.registerEditor('p1', fakeEditor());
    expect(controller.bufferTyping(insertText('z'))).toBe(false);
  });

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
