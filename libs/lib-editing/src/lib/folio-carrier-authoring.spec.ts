import { Editor, getSchema } from '@tiptap/core';
import { EditorState, TextSelection } from '@tiptap/pm/state';
import { splitBlock } from '@tiptap/pm/commands';
import { splitListItem } from '@tiptap/pm/schema-list';
import { v4 as uuidv4 } from 'uuid';
import type { Node } from '@tiptap/pm/model';
import type { Annotation, Passage } from '@eightyfourthousand/data-access';
import { blockFromPassage } from '@eightyfourthousand/lib-doc-model';
import { translationSSRExtensions } from './components/editor/extensions/translationSSRExtensions';
import TranslationMetadata from './components/editor/extensions/TranslationMetadata';
import { ensureUuids, passageFromNode } from './passage';

/**
 * The authoring half: an editor gives the opening folio reference its own line
 * with a plain Enter, and the save carries it.
 *
 * `LineNode` binds Enter to `splitListItem('line')`, which declines inside a
 * line, so Enter falls through to the base keymap's `splitBlock` — the command
 * exercised here. The first test pins both halves rather than assuming them.
 *
 * `TranslationMetadata` registers the global `uuid` attribute the exporters
 * read, so it joins the SSR extensions to build the schema.
 */

const extensions = [...translationSSRExtensions, TranslationMetadata];
const schema = getSchema(extensions);

const ranges = (passage: Passage, type: Annotation['type']): string[] =>
  (passage.annotations ?? [])
    .filter((annotation) => annotation.type === type)
    .map(({ start, end }) => `${start}..${end}`);

/** The loaded shape of Toh 572's passage 1.1: two folio mentions at the head of line 1. */
const loadedDoc = (): Node =>
  schema.nodes.doc.create({}, [
    schema.nodes.passage.create(
      { uuid: 'passage-1', label: '1.1', sort: 1, type: 'translation' },
      [
        schema.nodes.lineGroup.create({ uuid: 'group-1' }, [
          schema.nodes.line.create({ uuid: 'line-1' }, [
            schema.nodes.mention.create({
              uuid: 'mention-node-1',
              items: [
                {
                  uuid: 'mention-1',
                  entity: 'f1',
                  linkType: 'folio',
                  text: '[F.147.a]',
                },
                {
                  uuid: 'mention-2',
                  entity: 'f2',
                  linkType: 'folio',
                  text: '[F.199.a]',
                },
              ],
            }),
            schema.text('Homage to the Buddha, '),
          ]),
          schema.nodes.line.create({ uuid: 'line-2' }, [
            schema.text('Homage to the Dharma.'),
          ]),
        ]),
      ],
    ),
  ]);

/** Position immediately after the mention atom in the first line. */
const afterMention = (doc: Node): number => {
  let pos = -1;
  doc.descendants((node, position) => {
    if (pos === -1 && node.type.name === 'mention') {
      pos = position + node.nodeSize;
    }
  });
  if (pos === -1) throw new Error('no mention in the document');
  return pos;
};

const stateAtCaret = (doc: Node): EditorState =>
  EditorState.create({
    schema,
    doc,
    selection: TextSelection.create(doc, afterMention(doc)),
  });

/**
 * Mimics `ensureUuids()`: a split copies the original node's attrs, so both
 * halves carry one uuid until the editor stamps a fresh one on the duplicate.
 * The exporters locate nodes by uuid, so the save path depends on that having
 * happened.
 */
const dedupeUuids = (doc: Node): Node => {
  const seen = new Set<string>();
  const stamp = (node: Node): Node => {
    const children: Node[] = [];
    node.content.forEach((child) => children.push(stamp(child)));
    const content = children.length ? children : null;

    const uuid: string | null = node.attrs?.uuid ?? null;
    if (node.isText || !uuid) {
      return content ? node.type.create(node.attrs, content) : node;
    }
    const fresh = seen.has(uuid) ? uuidv4() : uuid;
    seen.add(fresh);
    return node.type.create({ ...node.attrs, uuid: fresh }, content, node.marks);
  };
  return stamp(doc);
};

const passageNode = (doc: Node): Node => {
  let found: Node | undefined;
  doc.descendants((node) => {
    if (!found && node.type.name === 'passage') found = node;
  });
  if (!found) throw new Error('no passage in the document');
  return found;
};

const exportPassage = (doc: Node): Passage =>
  passageFromNode(passageNode(dedupeUuids(doc)), 'work-1');

const pressEnter = (): EditorState => {
  let state = stateAtCaret(loadedDoc());
  const ran = splitBlock(state, (tr) => {
    state = state.apply(tr);
  });
  expect(ran).toBe(true);
  return state;
};

describe('giving the opening folio reference its own line', () => {
  it('splits via the base keymap, because splitListItem declines inside a line', () => {
    // The grandparent of a `line` textblock is the `lineGroup`, so the
    // list-item command does not apply and Enter falls through to splitBlock.
    expect(splitListItem(schema.nodes.line)(stateAtCaret(loadedDoc()))).toBe(
      false,
    );
    expect(splitBlock(stateAtCaret(loadedDoc()))).toBe(true);
  });

  it('leaves the mention alone on the first of the two lines', () => {
    const group = pressEnter().doc.firstChild?.firstChild;

    expect(group?.type.name).toBe('lineGroup');
    expect(group?.childCount).toBe(3);
    expect(group?.child(0).type.name).toBe('line');
    expect(group?.child(0).textContent).toBe('');
    expect(group?.child(0).childCount).toBe(1);
    expect(group?.child(0).child(0).type.name).toBe('mention');
    expect(group?.child(1).textContent).toBe('Homage to the Buddha, ');
  });

  it('exports the folio line rather than discarding it', () => {
    const passage = exportPassage(pressEnter().doc);

    expect(ranges(passage, 'line')).toEqual(['0..0', '0..22', '22..43']);
    expect(ranges(passage, 'mention')).toEqual(['0..0', '0..0']);
  });

  it('leaves the passage text and every other address untouched', () => {
    const before = exportPassage(loadedDoc());
    const after = exportPassage(pressEnter().doc);

    expect(after.content).toBe(before.content);
    expect(after.content).toBe('Homage to the Buddha, Homage to the Dharma.');
    expect(ranges(after, 'lineGroup')).toEqual(ranges(before, 'lineGroup'));
  });

  it('does not mark the export incomplete, so no annotations are held back', () => {
    expect(exportPassage(pressEnter().doc).annotationsIncomplete).toBeUndefined();
  });
});

/**
 * A passage with no text at all — a new one, or one cleared for the folio
 * reference to stand alone. It has no text node for a mention to attach to, so
 * before the zero-length carrier the mention was unplaceable on reload and
 * vanished from the editor on the save after it was added.
 */
describe('a folio reference in a passage with no text', () => {
  const loaded = (passage: Passage) =>
    blockFromPassage({
      ...passage,
      annotations: (passage.annotations ?? []).map((annotation) => ({
        ...annotation,
        validated: true,
      })),
    } as Passage);

  const empty = (): Passage =>
    ({
      uuid: 'passage-1',
      type: 'translation',
      workUuid: 'work-1',
      sort: 1,
      label: '1.1',
      content: '',
      annotations: [],
    }) as unknown as Passage;

  /** One editor session: load, optionally add a mention, normalize, export. */
  const session = (passage: Passage, addMention: boolean): Passage => {
    const editor = new Editor({
      element: document.createElement('div'),
      extensions,
      content: { type: 'doc', content: [loaded(passage)] },
    });

    if (addMention) {
      editor.commands.setTextSelection(2);
      // The shape `setMention` inserts: the item carries the uuid, the node's
      // own uuid is left for ensureUuids to stamp.
      editor.commands.insertContent({
        type: 'mention',
        attrs: {
          items: [
            { uuid: 'mention-1', entity: 'folio-1', linkType: 'folio' },
          ],
        },
      });
    }

    ensureUuids(editor);
    const node = editor.$node('passage', { uuid: 'passage-1' });
    if (!node) throw new Error('no passage node');
    const saved = passageFromNode(node.node, 'work-1');
    editor.destroy();
    return saved;
  };

  it('survives the save it was added in', () => {
    const saved = session(empty(), true);

    expect(ranges(saved, 'mention')).toEqual(['0..0']);
    expect(saved.content).toBe('');
    expect(saved.annotationsIncomplete).toBeUndefined();
  });

  it('is still there after reopening and saving again', () => {
    let passage = session(empty(), true);
    for (let i = 0; i < 3; i += 1) {
      passage = session(passage, false);
      expect(ranges(passage, 'mention')).toEqual(['0..0']);
    }
  });

  it('never grows a second, blank block', () => {
    let passage = session(empty(), true);
    for (let i = 0; i < 3; i += 1) {
      const block = loaded(passage) as { content?: unknown[] };
      expect(block.content).toHaveLength(1);
      passage = session(passage, false);
    }
  });
});
