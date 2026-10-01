import { getSchema } from '@tiptap/core';
import type { Extensions, JSONContent } from '@tiptap/core';
import type { Node, Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import type { Plugin } from '@tiptap/pm/state';
import { splitListItem } from '@tiptap/pm/schema-list';
import { splitBlock } from '@tiptap/pm/commands';
import {
  ANNOTATIONS_TO_IGNORE,
  annotationsFromDTO,
  annotationsToDTO,
  type AnnotationDTO,
  type Passage,
} from '@eightyfourthousand/data-access';
import {
  blockFromPassage,
  PassageDoc,
  passageFromNode,
} from '@eightyfourthousand/lib-doc-model';

import { buildStackSchemaExtensions } from '../stack/stack-extensions';
import { stackSeedFromPassage } from '../stack/types';
import { EnsureUniqueUuids } from './extensions/EnsureUniqueUuids';
import { useTranslationExtensions } from './hooks/useTranslationExtensions';

// See PassageStackController.spec.ts — building the schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/**
 * Block structure through load, an editor mounting, and export, in both
 * editors: what loads must export unchanged, and mounting an editor must not
 * edit the document, or the passage reads as unsaved with nothing typed.
 */

const stackSchema = getSchema(buildStackSchemaExtensions());
const tabSchema = getSchema(
  // Hook-shaped by name only — it calls no hooks and just assembles the list.
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useTranslationExtensions().extensions as Extensions,
);

const ensureUniqueUuids = (() => {
  const context = {} as ThisParameterType<
    NonNullable<typeof EnsureUniqueUuids.config.addProseMirrorPlugins>
  >;
  const plugins = EnsureUniqueUuids.config.addProseMirrorPlugins?.call(context);
  return plugins?.[0] as Plugin;
})();

const IDENTITY = { type: 'translation', sort: 1, label: '1' } as const;

const passage = (
  uuid: string,
  content: string,
  annotations: Omit<AnnotationDTO, 'passage_uuid'>[],
): Passage => ({
  ...IDENTITY,
  uuid,
  workUuid: 'work-1',
  content,
  annotations: annotationsFromDTO(
    annotations.map((a) => ({ ...a, passage_uuid: uuid })),
    content.length,
  ),
});

/** Each annotation as `type uuid start-end`, sorted. */
const rows = (passage: Passage) =>
  (passage.annotations ?? [])
    .map(({ type, uuid, start, end }) => `${type} ${uuid} ${start}-${end}`)
    .sort();

/** Apply a transaction the way a mounted editor does, with the uuid plugin. */
const withPlugin = (
  schema: Schema,
  doc: Node,
  edit: (state: EditorState) => EditorState = (state) => state,
): Node => {
  const state = edit(
    EditorState.create({ schema, doc, plugins: [ensureUniqueUuids] }),
  );
  let at = -1;
  state.doc.descendants((node, pos) => {
    if (at < 0 && node.isText) at = pos;
    return at < 0;
  });
  // A no-op edit, so the plugin's appendTransaction runs.
  return state.apply(state.tr.insertText('x', at).delete(at, at + 1)).doc;
};

/** The stack's document for a passage, as seeded from its row. */
const stackDoc = (row: Passage): Node => {
  const doc = new PassageDoc({
    uuid: row.uuid,
    workUuid: 'work-1',
    schema: stackSchema,
  });
  doc.seed(stackSeedFromPassage(row).content);
  return doc.toNode();
};

/** The paginated editor's document for a passage. */
const tabDoc = (row: Passage): Node =>
  tabSchema.nodeFromJSON({
    type: 'translation',
    content: [blockFromPassage(row)],
  });

const exportStack = (row: Passage, node: Node) =>
  passageFromNode(node, 'work-1', { ...IDENTITY, uuid: row.uuid });

const exportTab = (row: Passage, node: Node) =>
  passageFromNode(node.child(0), 'work-1', { ...IDENTITY, uuid: row.uuid });

const EDITORS = [
  { name: 'stack', schema: stackSchema, load: stackDoc, save: exportStack },
  {
    name: 'paginated editor',
    schema: tabSchema,
    load: tabDoc,
    save: exportTab,
  },
];

const plain = passage('passage-1', 'Hello world', []);

const bulletList = passage('passage-2', 'one two', [
  { uuid: 'list-1', type: 'list', start: 0, end: 7, content: [] },
  { uuid: 'item-1', type: 'list-item', start: 0, end: 3, content: [] },
  { uuid: 'item-2', type: 'list-item', start: 3, end: 7, content: [] },
]);

const table = passage('passage-3', 'ab', [
  { uuid: 'table-1', type: 'table', start: 0, end: 2, content: [] },
  { uuid: 'row-1', type: 'table-body-row', start: 0, end: 2, content: [] },
  { uuid: 'cell-1', type: 'table-body-data', start: 0, end: 1, content: [] },
  { uuid: 'cell-2', type: 'table-body-data', start: 1, end: 2, content: [] },
]);

describe.each(EDITORS)('block round trip in the $name', (editor) => {
  it.each([
    ['a plain passage', plain],
    ['a list', bulletList],
    ['a table', table],
  ])('does not edit %s when an editor mounts', (_, row) => {
    const loaded = editor.load(row);
    expect(withPlugin(editor.schema, loaded).toJSON()).toEqual(loaded.toJSON());
  });

  it.each([
    ['a plain passage', plain],
    ['a list', bulletList],
    ['a table', table],
  ])('exports %s as it was stored', (_, row) => {
    const mounted = withPlugin(editor.schema, editor.load(row));
    expect(rows(editor.save(row, mounted))).toEqual(rows(row));
  });

  it('keeps an aligned paragraph inside a list item', () => {
    const loaded = editor.load(bulletList);
    let pos = -1;
    loaded.descendants((node, at) => {
      if (pos < 0 && node.type.name === 'paragraph') pos = at;
      return pos < 0;
    });
    const aligned = withPlugin(editor.schema, loaded, (state) =>
      state.apply(state.tr.setNodeAttribute(pos, 'textAlign', 'center')),
    );
    const exported = rows(editor.save(bulletList, aligned));
    expect(exported.filter((row) => row.startsWith('paragraph '))).toEqual([
      expect.stringMatching(/^paragraph \S+ 0-3$/),
    ]);
    expect(exported).not.toContain('paragraph item-1 0-3');
  });
});

describe('numbered lists', () => {
  it.each(EDITORS)(
    'reload from the $name as a numbered list',
    ({ schema, save }) => {
      const numbered: JSONContent = {
        type: 'orderedList',
        attrs: { uuid: 'list-1' },
        content: ['one', 'two'].map((text, i) => ({
          type: 'listItem',
          attrs: { uuid: `item-${i + 1}` },
          content: [
            {
              type: 'paragraph',
              attrs: { uuid: `item-${i + 1}` },
              content: [{ type: 'text', text }],
            },
          ],
        })),
      };
      const doc =
        schema === tabSchema
          ? schema.nodeFromJSON({
              type: 'translation',
              content: [
                {
                  type: 'passage',
                  attrs: { uuid: 'passage-1', ...IDENTITY },
                  content: [numbered],
                },
              ],
            })
          : schema.nodeFromJSON({ type: 'doc', content: [numbered] });
      const row = { ...plain, content: 'onetwo' };
      const saved = save(row, doc);

      // Through the database's shape and back.
      const reloaded: Passage = {
        ...saved,
        annotations: annotationsFromDTO(
          annotationsToDTO(saved.annotations ?? []),
          saved.content.length,
        ),
      };

      for (const reload of [stackDoc, tabDoc]) {
        const node = reload(reloaded);
        const lists: Node[] = [];
        node.descendants((child) => {
          if (child.type.name === 'bulletList') lists.push(child);
          return true;
        });
        expect(() => node.check()).not.toThrow();
        expect(lists).toHaveLength(1);
        expect(lists[0].attrs.itemStyle).toBe('numbers');
        expect(lists[0].childCount).toBe(2);
      }
    },
  );
});

describe('splitting inside a wrapper', () => {
  const caretIn = (doc: Node, text: string, offset: number) => {
    let pos = -1;
    doc.descendants((node, at) => {
      if (pos < 0 && node.isText && node.text === text) pos = at + offset;
      return pos < 0;
    });
    return pos;
  };

  it('gives the new list item its own uuid and its paragraph the same one', () => {
    const doc = stackDoc(bulletList);
    const split = withPlugin(stackSchema, doc, (state) => {
      const at = caretIn(state.doc, 'one', 3);
      const next = state.apply(
        state.tr.setSelection(TextSelection.create(state.doc, at)),
      );
      let result = next;
      splitListItem(stackSchema.nodes.listItem)(next, (tr) => {
        result = next.apply(tr);
      });
      return result;
    });
    const items: Node[] = [];
    split.descendants((node) => {
      if (node.type.name === 'listItem') items.push(node);
      return true;
    });
    expect(items).toHaveLength(3);
    const uuids = items.map((item) => item.attrs.uuid);
    expect(new Set(uuids).size).toBe(3);
    for (const item of items) {
      expect(item.child(0).attrs.uuid).toBe(item.attrs.uuid);
    }
  });

  // The new item's paragraph is a copy: it takes the item's new uuid, and
  // must not keep the original paragraph's indent under the same uuid, or the
  // export has two indent rows with one key and the save fails.
  it("doesn't copy an indent into the new list item", () => {
    const indented = stackSchema.nodeFromJSON({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          attrs: { uuid: 'list-1' },
          content: [
            {
              type: 'listItem',
              attrs: { uuid: 'item-1' },
              content: [
                {
                  type: 'paragraph',
                  attrs: { uuid: 'item-1', indent: { uuid: 'indent-1' } },
                  content: [{ type: 'text', text: 'onetwo' }],
                },
              ],
            },
          ],
        },
      ],
    });
    const split = withPlugin(stackSchema, indented, (state) => {
      const at = caretIn(state.doc, 'onetwo', 3);
      const next = state.apply(
        state.tr.setSelection(TextSelection.create(state.doc, at)),
      );
      let result = next;
      splitListItem(stackSchema.nodes.listItem)(next, (tr) => {
        result = next.apply(tr);
      });
      return result;
    });
    const indents = rows(exportStack(plain, split)).filter((row) =>
      row.startsWith('indent '),
    );
    expect(indents).toEqual(['indent indent-1 0-3']);
  });

  it('gives a second paragraph in a table cell its own uuid', () => {
    const doc = stackDoc(table);
    const split = withPlugin(stackSchema, doc, (state) => {
      const at = caretIn(state.doc, 'a', 1);
      const next = state.apply(
        state.tr.setSelection(TextSelection.create(state.doc, at)),
      );
      let result = next;
      splitBlock(next, (tr) => {
        result = next.apply(tr);
      });
      return result;
    });
    const cell = split.firstChild?.firstChild?.firstChild;
    expect(cell?.childCount).toBe(2);
    expect(cell?.child(0).attrs.uuid).toBe('cell-1');
    expect(cell?.child(1).attrs.uuid).not.toBe('cell-1');
  });
});

describe.each(EDITORS)(
  'a folio reference on its own line in the $name',
  (editor) => {
    // The opening paragraph holds only the mention: its zero-length row is what
    // keeps the line break, so it is not a structural paragraph.
    it('keeps the break through a save and a reload', () => {
      const mention = {
        type: 'mention',
        attrs: {
          items: [
            { uuid: 'm1', entity: 'f1', linkType: 'folio', text: '[F.1.a]' },
          ],
        },
      };
      const blocks = [
        { type: 'paragraph', attrs: { uuid: 'passage-1' }, content: [mention] },
        {
          type: 'paragraph',
          attrs: { uuid: 'p2' },
          content: [{ type: 'text', text: 'Homage' }],
        },
      ];
      const doc =
        editor.schema === tabSchema
          ? tabSchema.nodeFromJSON({
              type: 'translation',
              content: [
                {
                  type: 'passage',
                  attrs: { uuid: 'passage-1', ...IDENTITY },
                  content: blocks,
                },
              ],
            })
          : stackSchema.nodeFromJSON({ type: 'doc', content: blocks });

      const saved = editor.save(plain, withPlugin(editor.schema, doc));
      expect(rows(saved)).toContainEqual(
        expect.stringMatching(/^paragraph \S+ 0-0$/),
      );

      const reloaded: Passage = {
        ...saved,
        annotations: annotationsFromDTO(
          annotationsToDTO(saved.annotations ?? []),
          saved.content.length,
        ),
      };
      const paragraphs: Node[] = [];
      stackDoc(reloaded).descendants((node) => {
        if (node.type.name === 'paragraph') paragraphs.push(node);
        return true;
      });
      expect(paragraphs.map((p) => p.textContent)).toEqual(['', 'Homage']);
    });
  },
);

describe('quote annotations', () => {
  it('are left alone by a save, since no document can hold them', () => {
    // The save's delete diff only reads types outside this list.
    expect(ANNOTATIONS_TO_IGNORE).toContain('quote');
  });
});
