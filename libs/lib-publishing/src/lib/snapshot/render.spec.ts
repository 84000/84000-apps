import type {
  PublishedAnnotation,
  PublishedBibliography,
  PublishedGlossaryTerm,
  PublishedPassage,
} from '../types';
import { sha256 } from '../serialize';
import { anchorOfLine } from './anchors';
import { SOFT_HYPHEN } from './normalize';
import type { DraftAlignment, DraftRows } from './read-draft';
import { renderSnapshotTree } from './render';

const WORK = '2cd55d9c-a17c-4d9f-9fce-e32e05b0192d';
const CHILD_NAME = 'c41d0000-0000-4000-8000-000000000000';
let n = 0;
const nextUuid = (prefix = '') => {
  n += 1;
  const hex = (
    prefix ? prefix + n.toString(16) : n.toString(16).padStart(8, '0')
  ).padEnd(32, '7');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
};

const passage = (
  type: string,
  label: string | null,
  content: string,
  uuid = nextUuid(),
): PublishedPassage => ({
  uuid,
  work_uuid: WORK,
  content,
  label,
  sort: ++n,
  parent: null,
  type,
  toh: 'toh145',
});

const annotation = (
  p: PublishedPassage,
  type: string,
  start: number,
  end: number,
  content: unknown = [],
): PublishedAnnotation => ({
  uuid: nextUuid(),
  passage_uuid: p.uuid,
  work_uuid: WORK,
  type,
  start,
  end,
  content,
  toh: 'toh145',
});

const fixture = (): DraftRows => {
  n = 0;
  const summary = passage('summary', 's.1', 'A short summary.');
  // Two passages whose uuids share their first eight hex digits.
  const header1 = passage(
    'translationHeader',
    '1.',
    'Chapter 1',
    nextUuid('abcdef12'),
  );
  const p1 = passage(
    'translation',
    '1.1',
    `Thus did I hear. Samanta${SOFT_HYPHEN}bhadra was there.`,
    nextUuid('abcdef12'),
  );
  const header2 = passage('translationHeader', '2.', 'Chapter 2: Gifts');
  const p2 = passage('translation', '2.1', 'The Blessed One said.');
  const note = passage('endnotes', 'n.1', 'A note\nover two lines.');
  const passages = [summary, header1, p1, header2, p2, note];

  const term: PublishedGlossaryTerm = {
    glossary_uuid: nextUuid(),
    authority_uuid: nextUuid(),
    work_uuid: WORK,
    headword: 'samantabhadra',
    headword_language: 'Sa-Ltn',
    english: 'Samantabhadra',
    wylie: 'kun tu bzang po',
    tibetan: 'ཀུན་ཏུ་བཟང་པོ།',
    sanskrit_plain: 'samantabhadra',
    sanskrit_attested: 'samantabhadra (Attested Source)',
    chinese: null,
    pali: null,
    alternatives: null,
    definition: '<p>A bodhisattva.</p>',
    english_sort: 'samantabhadra',
    headword_sort: 'samantabhadra',
    term_number: 1,
    search_text: null,
  };

  const annotations = [
    annotation(p1, 'glossary-instance', 17, 31, [
      { type: 'glossary', uuid: term.glossary_uuid },
    ]),
    annotation(p1, 'end-note-link', 16, 16, [{ uuid: note.uuid }]),
    annotation(p2, 'glossary-instance', 4, 15, [{ uuid: nextUuid() }]),
    annotation(p2, 'mention', 0, 3, [{ type: 'folio' }]),
    annotation(p2, 'paragraph', 0, 21),
  ];

  const bibliographies: PublishedBibliography[] = [
    {
      uuid: nextUuid(),
      work_uuid: WORK,
      bibl_html: null,
      sort: 1,
      heading: 'Tibetan Texts',
      is_heading: true,
      heading_uuid: null,
      toh: null,
    },
    {
      uuid: nextUuid(),
      work_uuid: WORK,
      bibl_html: '<i>dkon mchog</i> &amp; more',
      sort: 2,
      heading: null,
      is_heading: false,
      heading_uuid: null,
      toh: null,
    },
  ];

  const alignments: DraftAlignment[] = [
    {
      passage_uuid: p1.uuid,
      folio_uuid: nextUuid(),
      toh: 'toh145',
      tibetan: 'འདི་སྐད་\nབདག་གིས་',
      folio_number: 34,
      volume_number: 57,
      start_side_int: 1,
    },
    {
      passage_uuid: p1.uuid,
      folio_uuid: nextUuid(),
      toh: 'toh145',
      tibetan: 'ཐོས་པ།',
      folio_number: 35,
      volume_number: 57,
      start_side_int: 2,
    },
  ];

  return {
    work: {
      uuid: WORK,
      tohs: ['toh145', 'toh847'],
      title: 'The Jewel Torch',
      draftTouchedAt: '2026-10-08T18:50:28.517Z',
    },
    passages,
    annotations,
    glossary: [term],
    glossaryTermOf: new Map([
      [term.glossary_uuid, term.glossary_uuid],
      [CHILD_NAME, term.glossary_uuid],
    ]),
    bibliographies,
    alignments,
  };
};

const render = () =>
  renderSnapshotTree({
    rows: fixture(),
    generatedAt: '2026-10-12T00:00:00.000Z',
  });

const tsv = (text: string) =>
  text
    .trimEnd()
    .split('\n')
    .slice(1)
    .map((l) => l.split('\t'));

const ANCHORED = /^(text|tibetan)\/|^(notes|glossary|bibliography)\.md$/;

describe('renderSnapshotTree', () => {
  it('lays out text by section, chapter and notes, with a Tibetan mirror', () => {
    const { tree } = render();
    expect([...tree.keys()].sort()).toEqual([
      'README.md',
      'anchors.tsv',
      'annotations/annotations.jsonl',
      'annotations/glossary-instances.tsv',
      'annotations/layout.jsonl',
      'bibliography.md',
      'glossary.md',
      'manifest.json',
      'notes.md',
      'raw/glossary.jsonl',
      'raw/passages.jsonl',
      'text/00-summary.md',
      'text/04-translation/001-chapter-1.md',
      'text/04-translation/002-chapter-2-gifts.md',
      'tibetan/04-translation/001-chapter-1.md',
    ]);
  });

  it('writes one anchored passage per line, normalized, with note markers', () => {
    const { tree } = render();
    const chapter = tree.get('text/04-translation/001-chapter-1.md') ?? '';
    const [header, text] = chapter.split('\n');
    expect(header).toMatch(/^\[p-abcdef12[0-9a-f] 1\.\] ## Chapter 1$/);
    expect(text).toMatch(
      /^\[p-abcdef12[0-9a-f] 1\.1\] Thus did I hear\.\[\^n\.1\] Samantabhadra was there\.$/,
    );
  });

  it('resolves every anchored line to a uuid of the right kind', () => {
    const rows = fixture();
    const { tree, anchors } = renderSnapshotTree({
      rows,
      generatedAt: '2026-10-12T00:00:00.000Z',
    });
    const passageUuids = new Set(rows.passages.map((p) => p.uuid));
    let lines = 0;
    for (const [path, text] of tree) {
      if (!ANCHORED.test(path)) continue;
      for (const line of text.split('\n').filter(Boolean)) {
        lines += 1;
        const anchor = anchorOfLine(line);
        expect(anchor).not.toBeNull();
        expect(anchors.has(anchor as string)).toBe(true);
        if (anchor?.startsWith('p-')) {
          expect(passageUuids.has(anchors.get(anchor) as string)).toBe(true);
        }
      }
    }
    // 6 passages, 1 Tibetan line, 1 term, 2 bibliography rows.
    expect(lines).toBe(10);
  });

  it('round-trips anchors through anchors.tsv to the file and line', () => {
    const rows = fixture();
    const { tree } = renderSnapshotTree({ rows, generatedAt: 'now' });
    const table = tsv(tree.get('anchors.tsv') ?? '');
    expect(table).toHaveLength(
      rows.passages.length + rows.glossary.length + rows.bibliographies.length,
    );
    for (const [anchor, uuid, , , , , file, line] of table) {
      const text = (tree.get(file) ?? '').split('\n')[Number(line) - 1];
      expect(anchorOfLine(text)).toBe(anchor);
      expect(uuid.replace(/-/g, '').startsWith(anchor.slice(2))).toBe(true);
    }
  });

  it('lengthens only the colliding passage anchors', () => {
    const rows = fixture();
    const { manifest, tree } = renderSnapshotTree({ rows, generatedAt: 'now' });
    const anchors = tsv(tree.get('anchors.tsv') ?? '').map((r) => r[0]);
    expect(anchors.filter((a) => a.length > 'p-'.length + 8)).toHaveLength(2);
    expect(manifest.counts.lengthenedAnchors).toBe(2);
  });

  it('accounts for every row exactly once', () => {
    const rows = fixture();
    const { tree, manifest } = renderSnapshotTree({ rows, generatedAt: 'now' });
    const lineCount = (path: string) =>
      (tree.get(path) ?? '').split('\n').filter(Boolean).length;
    const passageLines = [...tree.keys()]
      .filter((p) => p.startsWith('text/') || p === 'notes.md')
      .reduce((sum, p) => sum + lineCount(p), 0);

    expect(passageLines).toBe(rows.passages.length);
    expect(
      lineCount('annotations/glossary-instances.tsv') -
        1 +
        lineCount('annotations/annotations.jsonl') +
        lineCount('annotations/layout.jsonl'),
    ).toBe(rows.annotations.length);
    expect(lineCount('glossary.md')).toBe(rows.glossary.length);
    expect(lineCount('bibliography.md')).toBe(rows.bibliographies.length);
    expect(manifest.counts).toMatchObject({
      passages: 6,
      annotations: 5,
      glossaryInstances: 2,
      otherAnnotations: 2,
      layoutAnnotations: 1,
      glossaryTerms: 1,
      bibliographies: 2,
      alignments: 2,
      alignedPassages: 1,
    });
  });

  it('joins glossary instances to their term and the text they cover', () => {
    const { tree } = render();
    const [resolved, unresolved] = tsv(
      tree.get('annotations/glossary-instances.tsv') ?? '',
    );
    expect(resolved.slice(1, 7)).toEqual([
      'Samantabhadra',
      resolved[2],
      '1.1',
      '17',
      '31',
      'Samantabhadra',
    ]);
    expect(resolved[0]).toMatch(/^g-[0-9a-f]{8}$/);
    expect(unresolved[0]).toMatch(/^unresolved:/);
    expect(unresolved[6]).toBe('Blessed One');
  });

  it('removes soft hyphens everywhere but raw/ and keeps every value on one line', () => {
    const { tree } = render();
    for (const [path, text] of tree) {
      if (path.startsWith('raw/')) continue;
      expect(text).not.toContain(SOFT_HYPHEN);
    }
    expect(tree.get('notes.md')).toContain('A note over two lines.');
    expect(tree.get('tibetan/04-translation/001-chapter-1.md')).toContain(
      'F.34–35 འདི་སྐད་བདག་གིས་ ཐོས་པ།',
    );
  });

  it('writes passages and terms to raw/ exactly as stored, in order', () => {
    const rows = fixture();
    const { tree, anchors } = renderSnapshotTree({ rows, generatedAt: 'now' });
    const raw = (tree.get('raw/passages.jsonl') ?? '')
      .trimEnd()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(raw).toEqual(
      rows.passages.map((p) => ({
        uuid: p.uuid,
        anchor: expect.any(String),
        content: p.content,
      })),
    );
    for (const r of raw) expect(anchors.get(r.anchor)).toBe(r.uuid);
    expect(raw[2].content).toContain(SOFT_HYPHEN);
    expect(raw[5].content).toBe('A note\nover two lines.');

    const [term] = rows.glossary;
    expect(JSON.parse(tree.get('raw/glossary.jsonl') ?? '')).toEqual({
      uuid: term.glossary_uuid,
      authority: term.authority_uuid,
      anchor: expect.stringMatching(/^g-[0-9a-f]{8}$/),
      english: term.english,
      alternatives: term.alternatives,
    });
  });

  it('renders glossary and bibliography lines as plain text', () => {
    const { tree } = render();
    expect(tree.get('glossary.md')).toMatch(
      /^\[g-[0-9a-f]{8} #1\] en: Samantabhadra \| bo: ཀུན་ཏུ་བཟང་པོ། \| wylie: kun tu bzang po \| sa: samantabhadra \(Attested Source\) \| def: A bodhisattva\.\n$/,
    );
    const [heading, entry] = (tree.get('bibliography.md') ?? '').split('\n');
    expect(heading).toMatch(/^\[b-[0-9a-f]{8}\] ## Tibetan Texts$/);
    expect(entry).toMatch(/^\[b-[0-9a-f]{8}\] dkon mchog & more$/);
  });

  it('describes every other file in the manifest', () => {
    const { tree, manifest } = render();
    expect(manifest.files.map((f) => f.path)).toEqual(
      [...tree.keys()].filter((p) => p !== 'manifest.json').sort(),
    );
    for (const file of manifest.files) {
      const text = tree.get(file.path) ?? '';
      expect(file.bytes).toBe(Buffer.byteLength(text, 'utf8'));
      expect(file.lines).toBe(text.split('\n').length - 1);
      expect(file.sha256).toBe(sha256(text));
    }
    expect(manifest.draftTouchedAt).toBe('2026-10-08T18:50:28.517Z');
    expect(JSON.parse(tree.get('manifest.json') ?? '')).toEqual(manifest);
  });

  it('is deterministic for a given draft and timestamp', () => {
    const a = render().tree;
    const b = render().tree;
    expect([...a]).toEqual([...b]);
  });

  it('resolves an instance citing a child name to its term', () => {
    const rows = fixture();
    const p1 = rows.passages[2];
    rows.annotations.push({
      ...rows.annotations[0],
      uuid: 'child-instance',
      content: [{ type: 'glossary', uuid: CHILD_NAME }],
      passage_uuid: p1.uuid,
    });
    const { tree } = renderSnapshotTree({ rows, generatedAt: 'now' });
    const row = tsv(tree.get('annotations/glossary-instances.tsv') ?? '').find(
      (r) => r[7] === 'child-instance',
    );
    expect(row?.[0]).toMatch(/^g-[0-9a-f]{8}$/);
    expect(row?.[1]).toBe('Samantabhadra');
  });

  it('adds the note anchor to a marker only when note labels repeat', () => {
    const rows = fixture();
    const twin = { ...rows.passages[5], uuid: nextUuid(), sort: 99 };
    rows.passages.push(twin);
    const { tree, anchors } = renderSnapshotTree({ rows, generatedAt: 'now' });
    const marker = /\[\^n\.1 (p-[0-9a-f]+)\]/.exec(
      tree.get('text/04-translation/001-chapter-1.md') ?? '',
    );
    expect(marker).not.toBeNull();
    expect(anchors.get(marker?.[1] as string)).toBe(rows.passages[5].uuid);
    expect(render().tree.get('text/04-translation/001-chapter-1.md')).toContain(
      '[^n.1]',
    );
  });

  it('keeps an unchaptered translation in one file', () => {
    const rows = fixture();
    rows.passages = rows.passages.filter((p) => p.type !== 'translationHeader');
    const { tree } = renderSnapshotTree({ rows, generatedAt: 'now' });
    expect(tree.has('text/04-translation.md')).toBe(true);
    expect(tree.has('tibetan/04-translation.md')).toBe(true);
  });
});
