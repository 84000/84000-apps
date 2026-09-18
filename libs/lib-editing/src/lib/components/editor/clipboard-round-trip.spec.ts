import { Editor, getSchema } from '@tiptap/core';
import type { Extensions } from '@tiptap/core';
import {
  DOMParser,
  DOMSerializer,
  Fragment,
  Schema,
  Slice,
} from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import type { Annotation } from '@eightyfourthousand/data-access';
import { passageFromNode } from '@eightyfourthousand/lib-doc-model';

import { buildStackSchemaExtensions } from '../stack/stack-extensions';
import { passagesFromHTML, passagesToHTML } from '../stack/stack-clipboard';
import { useTranslationExtensions } from './hooks/useTranslationExtensions';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/**
 * Copy and paste round trips a slice through HTML: ProseMirror serializes the
 * selection with the schema's `renderHTML` and parses it back with its
 * `parseHTML` rules. An annotation whose mark or node cannot make that trip is
 * silently dropped, downgraded to another type, or emptied of its attributes —
 * so every annotation-bearing type is checked here rather than one at a time.
 *
 * Both editors are covered because they share this schema: the per-tab editor
 * wraps blocks in `passage` nodes, the per-passage stack editor makes the
 * passage the document.
 */

const stackSchema = getSchema(buildStackSchemaExtensions());
const tabSchema = getSchema(
  // Hook-shaped by name only — it calls no hooks and just assembles the list.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useTranslationExtensions().extensions as Extensions,
);

/** The blocks a passage holds, as ProseMirror JSON. */
type Blocks = Record<string, unknown>[];

/** The fragment a within-passage selection yields, for each editor. */
const passageContent = (schema: Schema, blocks: Blocks): Fragment => {
  if (schema === tabSchema) {
    const doc = schema.nodeFromJSON({
      type: 'translation',
      content: [
        {
          type: 'passage',
          attrs: {
            uuid: 'passage-1',
            label: '1',
            sort: 0,
            type: 'translation',
          },
          content: blocks,
        },
      ],
    });
    return doc.child(0).content;
  }
  return schema.nodeFromJSON({ type: 'doc', content: blocks }).content;
};

/** The annotations a passage holding `fragment` would be saved with. */
const annotationsOf = (schema: Schema, fragment: Fragment): Annotation[] =>
  passageFromNode(schema.topNodeType.create(null, fragment), 'work-1', {
    uuid: 'passage-1',
    type: 'translation',
    sort: 0,
    label: '1',
  }).annotations;

/** What the clipboard carries, and what comes back when it is pasted. */
const throughClipboard = (schema: Schema, fragment: Fragment): Fragment => {
  const container = document.createElement('div');
  container.appendChild(
    DOMSerializer.fromSchema(schema).serializeFragment(fragment),
  );
  return DOMParser.fromSchema(schema).parse(container, {
    preserveWhitespace: true,
  }).content;
};

/**
 * Identity is deliberately not preserved: `EnsureUniqueUuids` mints a fresh
 * uuid for every pasted annotation so the copy does not collide with its
 * source. Everything else about the annotation has to survive.
 */
const withoutIdentity = (annotations: Annotation[]) =>
  annotations
    .map(({ uuid: _uuid, ...rest }) => rest)
    .map((annotation) => JSON.stringify(annotation))
    .sort();

const text = (marks: unknown[]) => ({
  type: 'text',
  text: 'hello world',
  marks,
});

const paragraph = (
  content: unknown[],
  attrs: Record<string, unknown> = {},
) => ({
  type: 'paragraph',
  attrs: { uuid: 'para-1', ...attrs },
  content,
});

const CASES: Record<string, Blocks> = {
  link: [
    paragraph([
      text([{ type: 'link', attrs: { href: 'https://e.com', uuid: 'm-1' } }]),
    ]),
  ],
  internalLink: [
    paragraph([
      text([
        {
          type: 'internalLink',
          attrs: {
            uuid: 'm-1',
            entity: 'entity-1',
            type: 'work',
            href: '/x',
            isSameWork: false,
            toh: 'toh417',
          },
        },
      ]),
    ]),
  ],
  glossaryInstance: [
    paragraph([
      text([
        {
          type: 'glossaryInstance',
          attrs: {
            uuid: 'm-1',
            glossary: 'glossary-1',
            authority: 'authority-1',
          },
        },
      ]),
    ]),
  ],
  endNoteLink: [
    paragraph([
      text([
        {
          type: 'endNoteLink',
          attrs: {
            uuid: 'm-1',
            notes: [{ uuid: 'note-1', endNote: 'endnote-1', label: '1' }],
          },
        },
      ]),
    ]),
  ],
  endNoteLinkScoped: [
    paragraph([
      text([
        {
          type: 'endNoteLink',
          attrs: {
            uuid: 'm-1',
            notes: [
              {
                uuid: 'note-1',
                endNote: 'endnote-1',
                label: '1',
                toh: 'toh417',
              },
              { uuid: 'note-2', endNote: 'endnote-2', label: '2' },
            ],
          },
        },
      ]),
    ]),
  ],
  foreign: [
    paragraph([
      text([{ type: 'foreign', attrs: { uuid: 'm-1', lang: 'Bo-Ltn' } }]),
    ]),
  ],
  mantra: [
    paragraph([
      text([{ type: 'mantra', attrs: { uuid: 'm-1', lang: 'Sa-Ltn' } }]),
    ]),
  ],
  smallCaps: [
    paragraph([
      text([
        { type: 'smallCaps', attrs: { uuid: 'm-1', textStyle: 'small-caps' } },
      ]),
    ]),
  ],
  bold: [paragraph([text([{ type: 'bold', attrs: { uuid: 'm-1' } }])])],
  italic: [paragraph([text([{ type: 'italic', attrs: { uuid: 'm-1' } }])])],
  underline: [
    paragraph([text([{ type: 'underline', attrs: { uuid: 'm-1' } }])]),
  ],
  subscript: [
    paragraph([text([{ type: 'subscript', attrs: { uuid: 'm-1' } }])]),
  ],
  superscript: [
    paragraph([text([{ type: 'superscript', attrs: { uuid: 'm-1' } }])]),
  ],
  mention: [
    paragraph([
      {
        type: 'mention',
        attrs: {
          uuid: 'mention-1',
          items: [
            {
              uuid: 'item-1',
              entity: 'entity-1',
              linkType: 'work',
              text: 'The Work',
              toh: 'toh417',
            },
          ],
        },
      },
    ]),
  ],
  abbreviation: [
    paragraph([
      {
        type: 'abbreviation',
        attrs: { uuid: 'abbr-1' },
        content: [{ type: 'text', text: 'A' }],
      },
    ]),
  ],
  hasAbbreviation: [
    paragraph([
      {
        type: 'hasAbbreviation',
        attrs: { uuid: 'has-1' },
        content: [{ type: 'text', text: 'Abbreviation' }],
      },
    ]),
  ],
  image: [
    { type: 'image', attrs: { src: 'https://e.com/a.png', uuid: 'image-1' } },
  ],
  audio: [
    { type: 'audio', attrs: { src: 'https://e.com/a.mp3', uuid: 'audio-1' } },
  ],
  heading: [
    {
      type: 'heading',
      attrs: { level: 2, uuid: 'head-1', class: 'body-title-main' },
      content: [{ type: 'text', text: 'Heading' }],
    },
  ],
  lineGroup: [
    {
      type: 'lineGroup',
      attrs: { uuid: 'lg-1' },
      content: [
        {
          type: 'line',
          attrs: { uuid: 'line-1' },
          content: [{ type: 'text', text: 'a line' }],
        },
        {
          type: 'line',
          attrs: { uuid: 'line-2' },
          content: [{ type: 'text', text: 'another' }],
        },
      ],
    },
  ],
  blockquote: [
    {
      type: 'blockquote',
      attrs: { uuid: 'quote-1' },
      content: [paragraph([{ type: 'text', text: 'quoted' }])],
    },
  ],
  trailer: [
    {
      type: 'trailer',
      attrs: { uuid: 'trailer-1' },
      content: [{ type: 'text', text: 'trailer' }],
    },
  ],
  bulletList: [
    {
      type: 'bulletList',
      attrs: { uuid: 'list-1' },
      content: [
        {
          type: 'listItem',
          attrs: { uuid: 'item-1' },
          content: [paragraph([{ type: 'text', text: 'item' }])],
        },
      ],
    },
  ],
  indent: [
    paragraph([{ type: 'text', text: 'indented' }], {
      indent: { uuid: 'indent-1' },
    }),
  ],
  leadingSpace: [
    paragraph([{ type: 'text', text: 'spaced' }], {
      leadingSpace: { uuid: 'space-1' },
    }),
  ],
  table: [
    {
      type: 'table',
      attrs: { uuid: 'table-1' },
      content: [
        {
          type: 'tableRow',
          attrs: { uuid: 'row-1' },
          content: [
            {
              type: 'tableCell',
              attrs: { uuid: 'cell-1' },
              content: [paragraph([{ type: 'text', text: 'cell' }])],
            },
          ],
        },
      ],
    },
  ],
  tohScope: [paragraph([{ type: 'text', text: 'scoped' }], { toh: 'toh417' })],
};

describe.each([
  ['per-passage stack editor', stackSchema],
  ['per-tab editor', tabSchema],
])('annotations survive copy and paste (%s)', (_name, schema) => {
  it.each(Object.keys(CASES))('%s', (name) => {
    const fragment = passageContent(schema, CASES[name]);
    const pasted = throughClipboard(schema, fragment);

    expect(withoutIdentity(annotationsOf(schema, pasted))).toEqual(
      withoutIdentity(annotationsOf(schema, fragment)),
    );
  });

  it('carries the text itself, not only the annotations', () => {
    const fragment = passageContent(schema, CASES['endNoteLink']);

    const pasted = throughClipboard(schema, fragment);

    expect(pasted.textBetween(0, pasted.size)).toBe('hello world');
  });
});

/**
 * The suite above stands on the schema's serialize/parse pair, which is what
 * ProseMirror's clipboard uses. This anchors it to the real thing: a selection
 * copied out of one editor and pasted into another, through the view's own
 * clipboard functions and the whole paste pipeline.
 */
describe('the editor clipboard itself', () => {
  const notesIn = (editor: Editor) => {
    const notes: unknown[] = [];
    editor.state.doc.descendants((node) => {
      node.marks
        .filter((mark) => mark.type.name === 'endNoteLink')
        .forEach((mark) => notes.push(mark.attrs.notes));
      return true;
    });
    return notes;
  };

  it('carries an endnote link from a real selection into another editor', () => {
    const extensions = buildStackSchemaExtensions();
    const source = new Editor({
      extensions,
      content: { type: 'doc', content: CASES['endNoteLink'] },
    });
    const target = new Editor({ extensions });

    source.view.dispatch(
      source.state.tr.setSelection(
        TextSelection.create(
          source.state.doc,
          1,
          source.state.doc.content.size - 1,
        ),
      ),
    );
    const { dom } = source.view.serializeForClipboard(
      source.state.selection.content(),
    );

    // jsdom has no ClipboardEvent, which pasteHTML otherwise constructs itself.
    const pasteEvent = new Event('paste') as ClipboardEvent;

    expect(target.view.pasteHTML(dom.innerHTML, pasteEvent)).toBe(true);

    // The note survives; only its identity is reminted, so the pasted copy
    // cannot upsert over the annotation row it was copied from.
    expect(notesIn(target)).toEqual([
      [expect.objectContaining({ endNote: 'endnote-1', label: '1' })],
    ]);
    expect((notesIn(target)[0] as { uuid: string }[])[0].uuid).not.toBe(
      'note-1',
    );

    source.destroy();
    target.destroy();
  });
});

/**
 * The stack's passage selection, which has its own serializer.
 *
 * A selection spanning rows snaps to whole passages, and each passage is its
 * own document — so the clipboard is written from those documents rather than
 * from the selected DOM. A row that is not being edited is drawn by the
 * reader's SSR extensions, whose markup the editor's parse rules cannot read
 * back, so anything taken from the DOM loses every annotation it crosses.
 */
describe('annotations survive a passage selection copy and paste', () => {
  /** Three passages, each holding the case under test. */
  const passages = (blocks: Blocks) =>
    [0, 1, 2].map(() =>
      stackSchema.nodeFromJSON({ type: 'doc', content: blocks }),
    );

  const annotationsOfBlocks = (blocks: Blocks) =>
    annotationsOf(
      stackSchema,
      stackSchema.nodeFromJSON({ type: 'doc', content: blocks }).content,
    );

  it.each(Object.keys(CASES))('%s', (name) => {
    const html = passagesToHTML(stackSchema, passages(CASES[name]));
    const pasted = passagesFromHTML(stackSchema, html);

    // One passage out per passage in, each carrying the same annotations.
    expect(pasted).toHaveLength(3);
    pasted.forEach((blocks) => {
      expect(
        withoutIdentity(
          annotationsOf(
            stackSchema,
            stackSchema.nodeFromJSON({ type: 'doc', content: blocks }).content,
          ),
        ),
      ).toEqual(withoutIdentity(annotationsOfBlocks(CASES[name])));
    });
  });

  it('keeps the passages apart rather than merging them', () => {
    const html = passagesToHTML(stackSchema, passages(CASES['bold']));

    expect(passagesFromHTML(stackSchema, html)).toHaveLength(3);
  });

  it('takes HTML that carries no passage boundaries as one passage', () => {
    const pasted = passagesFromHTML(
      stackSchema,
      '<p>from somewhere else</p><p>and a second block</p>',
    );

    expect(pasted).toHaveLength(1);
    expect(pasted[0]).toHaveLength(2);
  });
});

/**
 * Passage chrome, which the per-tab editor draws from the same `renderHTML`
 * the reader is server-rendered with.
 *
 * The label, the bookmark and the reference list are not content, and nothing
 * parses them back — so carrying them on the clipboard put the label text into
 * the pasted document as ordinary text, once per passage the selection
 * touched, whether or not that label was visibly selected.
 */
describe('a cross-passage copy carries no passage chrome', () => {
  const labelled = (uuid: string, label: string, text: string) => ({
    type: 'passage',
    attrs: { uuid, label, sort: 0, type: 'translation' },
    content: [paragraph([{ type: 'text', text }], { uuid: `${uuid}-p` })],
  });

  /** Two passages, selected from inside the first to inside the second. */
  const across = () => {
    const doc = tabSchema.nodeFromJSON({
      type: 'translation',
      content: [labelled('a', '1.2', 'alpha'), labelled('b', '1.3', 'bravo')],
    });
    return doc.slice(2, doc.content.size - 2);
  };

  /** The editor's clipboard serializer, as the paste side will read it. */
  const editorClipboardHTML = (slice: Slice) => {
    const editor = new Editor({
      // eslint-disable-next-line react-hooks/rules-of-hooks
      extensions: useTranslationExtensions().extensions as Extensions,
    });
    const { dom } = editor.view.serializeForClipboard(slice);
    editor.destroy();
    return dom.innerHTML;
  };

  it('leaves the labels out of the pasted text', () => {
    const html = editorClipboardHTML(across());

    const container = document.createElement('div');
    container.innerHTML = html;
    const pasted = DOMParser.fromSchema(tabSchema).parseSlice(container, {
      preserveWhitespace: true,
    });

    expect(pasted.content.textBetween(0, pasted.content.size, ' ')).toBe(
      'alpha bravo',
    );
  });

  it('puts no passage chrome on the clipboard at all', () => {
    const html = editorClipboardHTML(across());

    expect(html).not.toContain('data-passage-label');
    expect(html).not.toContain('passage-bookmark');
    // An object-valued attribute has no business on the clipboard either.
    expect(html).not.toContain('[object Object]');
  });
});
