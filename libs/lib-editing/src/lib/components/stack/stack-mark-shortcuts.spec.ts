import { Editor } from '@tiptap/core';

import { hydrated } from './stack-controller.fixture';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/**
 * Each mark shortcut must take its mark off again. Every application mints a
 * fresh uuid, so a toggle that compared attributes never saw the mark as
 * active and only ever set it.
 */
describe('stack editor mark shortcuts', () => {
  // The fixture's passage p0 reads `passage 0 text`.
  const WORD = 'passage';

  let editor: Editor | null = null;

  const mount = async () => {
    const { controller } = await hydrated(1);
    const element = document.createElement('div');
    document.body.append(element);
    editor = new Editor({
      element,
      extensions: controller.buildEditorExtensions('p0'),
    });
    let from = 0;
    editor.state.doc.descendants((node, pos) => {
      const at = node.isText ? (node.text ?? '').indexOf(WORD) : -1;
      if (at >= 0) from = pos + at;
    });
    editor.commands.setTextSelection({ from, to: from + WORD.length });
    return editor;
  };

  afterEach(() => {
    editor?.destroy();
    editor = null;
    document.body.innerHTML = '';
  });

  it.each([
    ['Mod-b', 'bold'],
    ['Mod-i', 'italic'],
    ['Mod-u', 'underline'],
    ['Mod-,', 'subscript'],
    ['Mod-.', 'superscript'],
    ['Mod-+', 'smallCaps'],
  ])('%s turns %s on and off', async (shortcut, mark) => {
    const mounted = await mount();

    mounted.commands.keyboardShortcut(shortcut);
    expect(mounted.isActive(mark)).toBe(true);

    mounted.commands.keyboardShortcut(shortcut);
    expect(mounted.isActive(mark)).toBe(false);
    expect(mounted.getText()).toBe('passage 0 text');
  });
});
