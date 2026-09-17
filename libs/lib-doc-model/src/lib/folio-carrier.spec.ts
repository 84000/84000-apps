import { Schema, Node } from '@tiptap/pm/model';
import type { Annotation, Passage } from '@eightyfourthousand/data-access';
import { blockFromPassage } from './block';
import { passageFromNode } from './passage';

/**
 * A folio reference on its own line: a block holding only the mention spans no
 * characters, so it persists as a zero-length annotation rather than being
 * dropped, and the mentions at its position load back into it.
 *
 * Both real shapes are covered: a line inside a lineGroup, and a bare paragraph
 * with no line structure at all.
 */

const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    passage: {
      group: 'block',
      content: 'block+',
      attrs: { uuid: { default: null } },
    },
    paragraph: {
      group: 'block',
      content: 'inline*',
      attrs: {
        uuid: { default: null },
        textAlign: { default: null },
        wordBreak: { default: null },
      },
    },
    lineGroup: {
      group: 'block',
      content: 'line+',
      attrs: { uuid: { default: null } },
    },
    line: { group: 'block', content: 'inline*', attrs: { uuid: { default: null } } },
    mention: {
      group: 'inline',
      inline: true,
      atom: true,
      attrs: { uuid: { default: null }, items: { default: [] } },
    },
    text: { group: 'inline' },
  },
});

const mention = (uuid: string, text: string): Node =>
  schema.nodes.mention.create({
    uuid,
    items: [{ uuid, entity: `entity-${uuid}`, linkType: 'folio', text }],
  });

const line = (uuid: string, content: Node[]): Node =>
  schema.nodes.line.create({ uuid }, content);

const exportPassage = (node: Node): Passage =>
  passageFromNode(node, 'work-1', {
    uuid: 'passage-1',
    type: 'translation',
    sort: 1,
    label: '1.1',
  });

const ranges = (passage: Passage, type: Annotation['type']): string[] =>
  (passage.annotations ?? [])
    .filter((annotation) => annotation.type === type)
    .map(({ start, end }) => `${start}..${end}`);

/** Marks every annotation validated, as `passageFromDTO` does on a real load. */
const forLoad = (passage: Passage): Passage => ({
  ...passage,
  annotations: (passage.annotations ?? []).map((annotation) => ({
    ...annotation,
    validated: true,
  })),
});

type Item = { type?: string; text?: string; attrs?: Record<string, unknown>; content?: Item[] };

/** The rendered tree as `type(start..end)` strings, for readable assertions. */
const shape = (item: Item): string => {
  const attrs = item.attrs ?? {};
  const range =
    typeof attrs.start === 'number' ? `(${attrs.start}..${attrs.end})` : '';
  const label = item.type === 'text' ? `text${range}=${JSON.stringify(item.text)}` : `${item.type}${range}`;
  const children = (item.content ?? []).map(shape);
  return children.length ? `${label}[${children.join(' ')}]` : label;
};

const itemCount = (item: Item, type: string): number =>
  (item.type === type ? 1 : 0) +
  (item.content ?? []).reduce((sum, child) => sum + itemCount(child, type), 0);

const find = (item: Item, predicate: (candidate: Item) => boolean): Item | undefined => {
  if (predicate(item)) return item;
  for (const child of item.content ?? []) {
    const found = find(child, predicate);
    if (found) return found;
  }
  return undefined;
};

describe('a folio reference on its own line (lineGroup shape, Toh 572)', () => {
  const build = (): Node =>
    schema.nodes.passage.create({ uuid: 'passage-1' }, [
      schema.nodes.lineGroup.create({ uuid: 'group-1' }, [
        line('line-folio', [
          mention('mention-1', '[F.147.a]'),
          mention('mention-2', '[F.199.a]'),
        ]),
        line('line-1', [schema.text('Homage to the Buddha, ')]),
        line('line-2', [schema.text('Homage to the Dharma.')]),
      ]),
    ]);

  it('exports the folio line as a zero-length annotation instead of dropping it', () => {
    const passage = exportPassage(build());

    expect(ranges(passage, 'line')).toEqual(['0..0', '0..22', '22..43']);
    expect(ranges(passage, 'mention')).toEqual(['0..0', '0..0']);
  });

  it('leaves the passage content and every other address untouched', () => {
    const passage = exportPassage(build());

    expect(passage.content).toBe('Homage to the Buddha, Homage to the Dharma.');
    expect(ranges(passage, 'lineGroup')).toEqual(['0..43']);
  });

  it('does not flag the export incomplete', () => {
    expect(exportPassage(build()).annotationsIncomplete).toBeUndefined();
  });

  it('loads the folio line back with both mentions inside it', () => {
    const block = blockFromPassage(forLoad(exportPassage(build()))) as Item;

    const folioLine = find(
      block,
      (candidate) =>
        candidate.type === 'line' &&
        candidate.attrs?.start === 0 &&
        candidate.attrs?.end === 0,
    );
    expect(folioLine).toBeDefined();
    expect(itemCount(folioLine as Item, 'mention')).toBe(1);
    expect((folioLine?.content?.[0]?.attrs?.items as unknown[])).toHaveLength(2);

    // Exactly one mention node in the whole passage, and it is in the folio
    // line rather than at the head of the first line of text.
    expect(itemCount(block, 'mention')).toBe(1);
    expect(shape(block)).toContain('line(0..0)[mention(0..0)] line(0..22)[text(0..22)="Homage to the Buddha, "]');
  });

  it('survives a second round trip unchanged', () => {
    const once = exportPassage(build());
    const reloaded = blockFromPassage(forLoad(once));

    expect(shape(reloaded as Item)).toBe(
      shape(blockFromPassage(forLoad(once)) as Item),
    );
    expect(ranges(once, 'line')).toEqual(['0..0', '0..22', '22..43']);
  });
});

describe('a folio reference on its own line (bare paragraph shape, Toh 209)', () => {
  const build = (): Node =>
    schema.nodes.passage.create({ uuid: 'passage-1' }, [
      // The template paragraph shares the passage uuid and is skipped on
      // export; the folio paragraph and the text paragraph are its siblings.
      schema.nodes.paragraph.create({ uuid: 'para-folio' }, [
        mention('mention-1', '[F.111.b]'),
        mention('mention-2', '[F.112.a]'),
      ]),
      schema.nodes.paragraph.create({ uuid: 'para-text' }, [
        schema.text('Homage to all buddhas and bodhisattvas!'),
      ]),
    ]);

  it('exports the folio paragraph as a zero-length annotation', () => {
    const passage = exportPassage(build());

    expect(ranges(passage, 'paragraph')).toEqual(['0..0', '0..39']);
    expect(passage.content).toBe('Homage to all buddhas and bodhisattvas!');
    expect(passage.annotationsIncomplete).toBeUndefined();
  });

  it('loads the folio paragraph back with both mentions inside it', () => {
    const block = blockFromPassage(forLoad(exportPassage(build()))) as Item;

    const folioParagraph = find(
      block,
      (candidate) =>
        candidate.type === 'paragraph' &&
        candidate.attrs?.start === 0 &&
        candidate.attrs?.end === 0,
    );
    expect(folioParagraph).toBeDefined();
    expect(itemCount(folioParagraph as Item, 'mention')).toBe(1);
    expect(folioParagraph?.content?.[0]?.attrs?.items).toHaveLength(2);
    expect(itemCount(block, 'mention')).toBe(1);
  });
});

describe('blocks with nothing in them at all', () => {
  it('still drops a line with no children', () => {
    const node = schema.nodes.passage.create({ uuid: 'passage-1' }, [
      schema.nodes.lineGroup.create({ uuid: 'group-1' }, [
        line('line-empty', []),
        line('line-1', [schema.text('Homage to the Buddha.')]),
      ]),
    ]);

    expect(ranges(exportPassage(node), 'line')).toEqual(['0..21']);
  });
});

describe('leading space alongside a folio carrier', () => {
  it('attaches to the block carrying the text, not to the carrier', () => {
    const passage: Passage = {
      uuid: 'passage-1',
      type: 'translation',
      workUuid: 'work-1',
      sort: 1,
      label: '1.1',
      content: 'Homage to all buddhas and bodhisattvas!',
      annotations: [
        { uuid: 'para-folio', type: 'paragraph', passageUuid: 'passage-1', start: 0, end: 0 },
        { uuid: 'para-text', type: 'paragraph', passageUuid: 'passage-1', start: 0, end: 39 },
        { uuid: 'space-1', type: 'leadingSpace', passageUuid: 'passage-1', start: 0, end: 0 },
      ],
    } as unknown as Passage;

    const block = blockFromPassage(forLoad(passage)) as Item;

    const carrier = find(
      block,
      (candidate) => candidate.attrs?.uuid === 'para-folio',
    );
    const textBlock = find(
      block,
      (candidate) => candidate.attrs?.uuid === 'para-text',
    );

    expect(carrier?.attrs?.leadingSpace).toBeUndefined();
    expect(textBlock?.attrs?.leadingSpace).toEqual({ uuid: 'space-1' });
  });
});
