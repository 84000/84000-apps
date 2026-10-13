import { Editor } from '@tiptap/core';

import { buildStackSchemaExtensions } from '../../stack/stack-extensions';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

const cell = (text: string) => ({
  type: 'tableCell',
  content: [
    {
      type: 'paragraph',
      attrs: { uuid: text },
      content: [{ type: 'text', text }],
    },
  ],
});

describe('TableKit', () => {
  it('styles a live table the same as its static HTML', () => {
    const editor = new Editor({
      extensions: buildStackSchemaExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'table',
            content: [{ type: 'tableRow', content: [cell('a'), cell('b')] }],
          },
        ],
      },
    });

    const live = editor.view.dom.querySelector('table');
    const html = document.createElement('div');
    html.innerHTML = editor.getHTML();
    const rendered = html.querySelector('table');

    expect(rendered?.className).toContain('bg-surface');
    expect(live?.className).toBe(rendered?.className);
    editor.destroy();
  });
});
