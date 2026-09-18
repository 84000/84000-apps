import { Editor, getSchema } from '@tiptap/core';
import type { Extensions } from '@tiptap/core';

import { buildStackSchemaExtensions } from '../../stack/stack-extensions';
import { useTranslationExtensions } from '../hooks/useTranslationExtensions';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/**
 * A trailer has to win the `p` tag against Paragraph when parsing, and lose to
 * it everywhere else.
 *
 * Both claim `p`, so the more specific `p[type="trailer"]` must be tried
 * first. Buying that with an extension priority above Paragraph's also sorts
 * the node ahead of Paragraph in the schema — and a content match takes its
 * default type from that order, so every split of a block produced a trailer.
 * Visibly: pressing Enter gave an italic block, and whatever was typed or
 * pasted into it came out italic.
 */
describe('Trailer', () => {
  const stackSchema = getSchema(buildStackSchemaExtensions());
  const tabSchema = getSchema(
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useTranslationExtensions().extensions as Extensions,
  );

  it('is not the default block type of the stack editor', () => {
    expect(stackSchema.nodes.doc.contentMatch.defaultType?.name).toBe(
      'paragraph',
    );
  });

  it('is not the default block type inside a per-tab passage', () => {
    expect(tabSchema.nodes.passage.contentMatch.defaultType?.name).toBe(
      'paragraph',
    );
  });

  it('is not what splitting a block produces', () => {
    const editor = new Editor({
      extensions: buildStackSchemaExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            attrs: { uuid: 'a' },
            content: [{ type: 'text', text: 'alpha' }],
          },
        ],
      },
    });

    editor.commands.focus('end');
    editor.commands.splitBlock();

    expect(editor.state.doc.lastChild?.type.name).toBe('paragraph');
    editor.destroy();
  });

  it('still parses back as a trailer through the clipboard', () => {
    const source = new Editor({
      extensions: buildStackSchemaExtensions(),
      content: {
        type: 'doc',
        content: [
          {
            type: 'trailer',
            attrs: { uuid: 't' },
            content: [{ type: 'text', text: 'trailing' }],
          },
        ],
      },
    });
    const target = new Editor({ extensions: buildStackSchemaExtensions() });

    const { dom } = source.view.serializeForClipboard(
      source.state.doc.slice(0),
    );
    target.view.pasteHTML(dom.innerHTML, new Event('paste') as ClipboardEvent);

    expect(target.state.doc.firstChild?.type.name).toBe('trailer');
    source.destroy();
    target.destroy();
  });
});
