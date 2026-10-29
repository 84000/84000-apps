import { Editor } from '@tiptap/core';

import type { PassageStackController } from './StackController';
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

  describe('scrolling on focus', () => {
    /**
     * A scroll handler that moves a fake viewport, and an editor whose
     * `posAtCoords` reads the text under a screen point in that viewport — a
     * stand-in for layout, which jsdom does not do.
     */
    const viewport = (controller: PassageStackController) => {
      const view = { scrollTop: 0, scrolls: [] as number[] };
      controller.addScrollHandler((index) => {
        view.scrolls.push(index);
        // A row taller than the viewport is moved to an edge.
        view.scrollTop += 400;
      });
      const editorAt = (uuid: string) => {
        const editor = mountEditor(controller, uuid);
        editor.view.posAtCoords = ({ top }) => {
          const pos = Math.floor((top + view.scrollTop) / 100) + 1;
          return { pos, inside: -1 };
        };
        return editor;
      };
      return { view, editorAt };
    };

    it('does not scroll when a click focuses a static row', async () => {
      const { controller } = await hydrated(3);
      const { view } = viewport(controller);

      controller.focusPassage('p1', { x: 10, y: 250 });

      expect(view.scrolls).toEqual([]);
    });

    it('does not scroll when a click focuses a mounted editor', async () => {
      const { controller } = await hydrated(3);
      const { view, editorAt } = viewport(controller);
      const editor = editorAt('p1');
      controller.registerEditor('p1', editor);

      controller.focusPassage('p1', { x: 10, y: 250 });

      expect(view.scrolls).toEqual([]);
      editor.destroy();
    });

    // Regression: the scroll ran before the editor mounted, so the click's
    // screen point was resolved over text the scroll had moved there.
    it('lands the caret where a static row was clicked', async () => {
      const { controller } = await hydrated(3);
      const { editorAt } = viewport(controller);

      controller.focusPassage('p1', { x: 10, y: 250 });
      const editor = editorAt('p1');
      controller.registerEditor('p1', editor);

      // y 250 with no scroll is position 3.
      expect(editor.state.selection.from).toBe(3);
      editor.destroy();
    });

    it.each([
      ['start', 'start'],
      ['end', 'end'],
      ['a document position', 2],
    ] as const)('still scrolls to a row focused at %s', async (_, where) => {
      const { controller } = await hydrated(3);
      const { view } = viewport(controller);

      controller.focusPassage('p2', where);

      expect(view.scrolls).toEqual([2]);
    });

    it('still scrolls when keyboard navigation moves focus', async () => {
      const { controller } = await hydrated(3);
      const { view } = viewport(controller);

      controller.focusRelative('p1', 1, 'start');

      expect(view.scrolls).toEqual([2]);
    });
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

// DEV-847: the layout mounts a stack twice over one controller (the desktop
// and mobile trees), and each copy installs a scroll handler. With one slot,
// the copy that installed last took every scroll, and one leaving cleared it
// for the other.
describe('PassageStackController scroll handlers', () => {
  it('scrolls through every copy that installed a handler', async () => {
    const { controller } = await hydrated(3);
    const desktop = jest.fn();
    const mobile = jest.fn();
    controller.addScrollHandler(desktop);
    controller.addScrollHandler(mobile);

    controller.focusPassage('p1');

    expect(desktop).toHaveBeenCalledWith(1, undefined);
    expect(mobile).toHaveBeenCalledWith(1, undefined);
  });

  it('keeps the other copy installed when one is removed', async () => {
    const { controller } = await hydrated(3);
    const desktop = jest.fn();
    controller.addScrollHandler(desktop);
    const removeMobile = controller.addScrollHandler(jest.fn());

    removeMobile();
    controller.focusPassage('p2');

    expect(desktop).toHaveBeenCalledWith(2, undefined);
  });
});
