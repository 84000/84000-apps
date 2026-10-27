import {
  ANNOTATION_TYPE_DTO_TO_TYPE,
  ANNOTATIONS_TO_IGNORE,
  annotationFromDTO,
  passagesFromDTO,
  passageToDTO,
  type AnnotationDTO,
  type AnnotationDTOType,
  type PassageDTO,
} from '@eightyfourthousand/data-access';
import {
  PassageLoader,
  blockFromPassage,
  type PassageSource,
} from '@eightyfourthousand/lib-doc-model';
import { createStackWorkDocument } from './stack-work';

// See PassageStackController.spec.ts — building the stack schema reaches
// `data-access/ssr` through two client barrels that leak it.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

/**
 * The stack editor's save contract: every content key the editor models, on
 * every annotation type, comes back from a save exactly as it was stored.
 *
 * Each fixture row is loaded the way the API serves a passage, hydrated into
 * the stack's schema, and materialized into the rows a save writes. Any key or
 * value that does not survive fails the test, as does a stored row that does
 * not come back at all.
 *
 * The editor does not carry stored keys it does not model. Those are listed in
 * `NOT_MODELLED` below, with the reason, and kept out of the fixtures.
 */

type Content = AnnotationDTO['content'];
type Row = Omit<AnnotationDTO, 'passage_uuid'>;

/**
 * Stored keys a data-access transformer reads that the editor deliberately
 * does not carry. Every other key a transformer reads must be covered by a
 * fixture below.
 */
const NOT_MODELLED: Partial<Record<AnnotationDTOType, string[]>> = {
  // A link's tooltip text. Not authored or shown by the editor.
  link: ['title'],
  // The note's display label. Read, but never written by a save.
  'end-note-link': ['label'],
};

/** Builds a passage's text and rows, one segment at a time. */
const passage = (
  uuid: string,
  build: (b: {
    /** Appends text, returning its range. */
    text: (value: string) => [number, number];
    row: (
      uuid: string,
      type: AnnotationDTOType,
      range: [number, number],
      content?: Content,
      toh?: string,
    ) => void;
  }) => void,
): PassageDTO => {
  let content = '';
  const annotations: Row[] = [];
  build({
    text: (value) => {
      const start = content.length;
      content += value;
      return [start, content.length];
    },
    row: (rowUuid, type, [start, end], rowContent = [], toh) => {
      annotations.push({
        uuid: rowUuid,
        type,
        start,
        end,
        content: rowContent,
        ...(toh ? { toh } : {}),
      });
    },
  });
  return {
    uuid,
    sort: 0,
    type: 'translation',
    label: uuid,
    content,
    work_uuid: 'w1',
    annotations: annotations.map((a) => ({ ...a, passage_uuid: uuid })),
  };
};

/** Words, each followed by a space no annotation covers. */
const words = (
  b: Parameters<Parameters<typeof passage>[1]>[0],
  rows: [string, AnnotationDTOType, Content, string?][],
) => {
  for (const [uuid, type, content, toh] of rows) {
    const range = b.text(`${uuid}`);
    b.row(uuid, type, range, content, toh);
    b.text(' ');
  }
};

const SPAN_STYLES = [
  'distinct',
  'emphasis',
  'italic',
  'small-caps',
  'subscript',
  'superscript',
  'text-bold',
  'underline',
];
const FOREIGN_LANGS = [
  'Bo-Ltn',
  'Pi-Ltn',
  'Sa-Ltn',
  'Zh-Ltn',
  'en',
  'foreign',
  'ja',
  'zh',
];
const TITLE_LANGS = [
  'Bo-Ltn',
  'Mt-Ltn',
  'Pi-Ltn',
  'Sa-Ltn',
  'Zh-Ltn',
  'en',
  'ja',
  'zh',
];
const MANTRA_LANGS = ['Bo-Ltn', 'Pi-Ltn', 'Sa-Ltn', 'en', 'zh'];

/** Inline marks, one per word, inside one paragraph. */
const inline = passage('p-inline', (b) => {
  const start = b.text('');
  words(b, [
    ['abbr-1', 'abbreviation', [{ uuid: 'e-abbr' }]],
    ['has-abbr-1', 'has-abbreviation', [{ uuid: 'e-abbr' }]],
    ['comment-1', 'comment', [{ uuid: 'e-thread' }]],
    [
      'gloss-1',
      'glossary-instance',
      [{ uuid: 'e-gloss' }, { authority: 'e-authority' }],
      'toh1-1',
    ],
    ...SPAN_STYLES.map((style): [string, AnnotationDTOType, Content] => [
      `span-${style}`,
      'span',
      [{ 'text-style': style }],
    ]),
    ...FOREIGN_LANGS.map((lang): [string, AnnotationDTOType, Content] => [
      `foreign-${lang}`,
      'span',
      [{ lang, 'text-style': 'foreign' }],
    ]),
    ...TITLE_LANGS.map((lang): [string, AnnotationDTOType, Content] => [
      `title-${lang}`,
      'inline-title',
      [{ lang }],
    ]),
    ...MANTRA_LANGS.map((lang): [string, AnnotationDTOType, Content] => [
      `mantra-${lang}`,
      'mantra',
      [{ lang }],
    ]),
    ['link-1', 'link', [{ href: 'https://84000.co/about' }]],
    ['code-1', 'code', []],
  ]);
  // End-note links are insertion points.
  for (const [uuid, content] of [
    ['note-1', [{ uuid: 'e-note' }]],
    ['note-2', [{ uuid: 'e-note-2' }]],
  ] as [string, Content][]) {
    const at = b.text('note')[1];
    b.row(uuid, 'end-note-link', [at, at], content);
    b.text(' ');
  }
  b.row(
    'para-inline',
    'paragraph',
    [start[0], b.text('end')[1]],
    [{ align: 'left' }, { 'word-break': 'break-all' }],
  );
});

/**
 * Every stored internal-link shape. These are transitional: the editor shows
 * and keeps them but offers no way to author new ones.
 */
const INTERNAL_LINKS: [string, Content][] = [
  [
    'il-href-only',
    [{ href: '/translation/toh10/index/toh3808#UT22084-029-001-13232' }],
  ],
  [
    'il-pending',
    [{ 'link-type': 'pending' }, { href: '/translation/toh1-17' }],
  ],
  [
    'il-not-found',
    [
      { type: 'passage' },
      { href: '#UT22084-077-002-245' },
      { 'link-type': 'not-found' },
      { uuid: 'e-passage-1' },
      { same_work: true },
      { subtype: 'translation' },
    ],
  ],
  [
    'il-work',
    [
      { href: '/translation/toh1-1' },
      { uuid: 'e-work-1' },
      { type: 'work' },
      { subtype: 'translation' },
      { toh: 'toh1-1' },
    ],
  ],
  [
    'il-passage-label',
    [
      { type: 'passage' },
      { label: '1.1' },
      { uuid: 'e-passage-2' },
      { href: 'UT22084-001-006-chapter-9-10-6-6' },
      { same_work: true },
      { subtype: 'translationHeader' },
    ],
  ],
  [
    'il-passage-empty-label',
    [
      { type: 'passage' },
      { label: '' },
      { uuid: 'e-passage-3' },
      { href: 'UT22084-001-003-section-3-4' },
      { same_work: true },
      { subtype: 'translationHeader' },
    ],
  ],
  [
    'il-other-work',
    [
      { href: '/translation/toh1040.html#UT22084-091-048-71-2' },
      { uuid: 'e-passage-4' },
      { type: 'passage' },
      { subtype: 'endnotes' },
      { toh: 'toh1040' },
      { same_work: false },
    ],
  ],
  [
    'il-appendix-header',
    [
      { href: '/entity/passage/e-passage-5' },
      { uuid: 'e-passage-5' },
      { type: 'passage' },
      { same_work: true },
      { subtype: 'appendixHeader' },
    ],
  ],
  [
    'il-anchor',
    [{ href: '#abbreviations' }, { uuid: 'e-passage-6' }, { type: 'passage' }],
  ],
];

const internalLinks = passage('p-internal-links', (b) => {
  const start = b.text('');
  words(
    b,
    INTERNAL_LINKS.map(([uuid, content]) => [
      uuid,
      'internal-link',
      content,
      'toh90001',
    ]),
  );
  b.row('para-internal-links', 'paragraph', [start[0], b.text('end')[1]]);
});

/** Mentions: zero-length atoms, batched into one node at a position. */
const MENTIONS: [string, Content][] = [
  [
    'mention-folio',
    [{ toh: 'toh1-1', type: 'folio', uuid: 'e-folio-1', same_work: true }],
  ],
  [
    'mention-bampo',
    [
      { type: 'folio' },
      { uuid: 'e-folio-2' },
      { text: '[B5]' },
      { same_work: true },
      { subtype: 'bampo' },
    ],
  ],
  [
    'mention-quote',
    [
      {
        end: 10,
        type: 'passage',
        uuid: 'e-passage-7',
        start: 5,
        style: 'quote',
      },
      { text: 'P25k' },
    ],
  ],
  [
    'mention-work',
    [
      { uuid: 'e-work-2' },
      { type: 'work' },
      { toh: 'toh1-4' },
      { text: 'The Chapter on the Rains' },
      { lang: 'en' },
      { same_work: false },
    ],
  ],
  [
    'mention-not-found',
    [
      { 'link-type': 'not-found' },
      { uuid: 'e-passage-8' },
      { type: 'passage' },
      { subtype: 'endnotes' },
      { same_work: true },
    ],
  ],
];

const mentions = passage('p-mentions', (b) => {
  const [start] = b.text('Before ');
  for (const [uuid, content] of MENTIONS) {
    const at = b.text('')[0];
    b.row(uuid, 'mention', [at, at], content);
  }
  b.row('para-mentions', 'paragraph', [start, b.text('after.')[1]]);
});

/** Block types, as siblings. */
const blocks = passage('p-blocks', (b) => {
  for (let level = 1; level <= 9; level++) {
    b.row(`heading-h${level}`, 'heading', b.text(`Heading ${level}`), [
      { 'heading-level': `h${level}` },
      { 'heading-type': level === 2 ? 'section-label' : 'section-title' },
      ...(level === 3 ? [{ align: 'center' }] : []),
    ]);
  }
  const indented = b.text('An indented paragraph.');
  b.row('para-block', 'paragraph', indented);
  b.row('indent-1', 'indent', indented);
  const spaced = b.text('A spaced paragraph.');
  b.row('para-spaced', 'paragraph', spaced);
  b.row('leading-space-1', 'leading-space', [spaced[0], spaced[0]]);
  b.row('trailer-1', 'trailer', b.text('Thus ends the sutra.'));
  b.row('quote-block-1', 'blockquote', b.text('A quoted verse.'));
  const media = b.text('');
  b.row('image-1', 'image', media, [
    {
      src: 'https://api.84000.co/storage/v1/object/public/assets/image/toh686-lotus-pericarp.png',
    },
  ]);
  b.row('audio-1', 'audio', media, [
    {
      src: 'https://api.84000.co/storage/v1/object/public/assets/audio/toh545.mp3',
      'media-type': 'audio/mpeg',
    },
    { title: 'A recitation of the The Dhāraṇī of Tārā' },
  ]);
  b.row('para-after-media', 'paragraph', b.text('After the media.'));
  const untitled = b.text('');
  b.row('audio-untitled', 'audio', untitled, [
    { src: 'https://e.com/a.mp3', 'media-type': 'audio/mpeg' },
    { title: '' },
  ]);
  b.row('para-last', 'paragraph', b.text('The end.'));
});

const verse = passage('p-verse', (b) => {
  const group = b.text('');
  b.row('line-sa', 'line', b.text('oṃ maṇi padme hūṃ'), [{ lang: 'Sa-Ltn' }]);
  b.row('line-en', 'line', b.text('Homage to the jewel'), [{ lang: 'en' }]);
  b.row('line-plain', 'line', b.text('in the lotus'));
  b.row('line-group-1', 'line-group', [group[0], b.text('')[1]]);
});

const list = passage('p-list', (b) => {
  const [start] = b.text('');
  b.row('item-1', 'list-item', b.text('one'));
  b.row('item-2', 'list-item', b.text('two'));
  b.row(
    'list-1',
    'list',
    [start, b.text('')[1]],
    [
      { 'list-spacing': 'horizontal' },
      { 'list-item-style': 'letters' },
      { nesting: 2 },
    ],
  );
});

const table = passage('p-table', (b) => {
  const [start] = b.text('');
  const [rowStart] = b.text('');
  b.row('cell-h', 'table-body-header', b.text('Name'));
  b.row('cell-d', 'table-body-data', b.text('Value'));
  b.row('row-1', 'table-body-row', [rowStart, b.text('')[1]]);
  b.row('table-1', 'table', [start, b.text('')[1]]);
});

const FIXTURES = [inline, internalLinks, mentions, blocks, verse, list, table];

/** A row's content as one object, ignoring how it is split into entries. */
const merged = (content: Content = []) => Object.assign({}, ...content);

/** The stored content keys a data-access transformer reads for a type. */
const keysRead = (type: AnnotationDTOType): string[] => {
  const keys = new Set<string>();
  const probe = new Proxy({} as Record<string, unknown>, {
    get: (_, key) => {
      if (typeof key === 'string') keys.add(key);
      return undefined;
    },
    has: (_, key) => {
      if (typeof key === 'string') keys.add(key);
      return false;
    },
  });
  annotationFromDTO(
    { uuid: 'u', type, start: 0, end: 1, passage_uuid: 'p', content: [probe] },
    1,
  );
  return [...keys].sort();
};

const loadAndSave = async (dtos: PassageDTO[]) => {
  const blocks = new Map(
    passagesFromDTO(dtos).map((p) => [p.uuid, blockFromPassage(p)]),
  );
  const source: PassageSource = {
    name: 'test',
    loadPassages: async (_workUuid, uuids) =>
      uuids.map((uuid) => ({
        uuid,
        content: (blocks.get(uuid)?.content ?? []) as never,
      })),
  };
  const work = createStackWorkDocument({
    workUuid: 'w1',
    loader: new PassageLoader({ sources: [source], buffer: 0 }),
  });
  work.seedSpine(
    dtos.map(({ uuid, label }) => ({ uuid, label, type: 'translation' })),
  );
  await work.hydrateWindow({ start: 0, end: dtos.length });

  // As `dirtyPassages` materializes a passage for a save.
  return dtos.flatMap((dto) => {
    const doc = work.store.peek(dto.uuid);
    doc?.ensureUniqueMarkUuids();
    const passage = doc?.toPassage({
      label: dto.label,
      sort: 0,
      type: 'translation',
    });
    return passage ? (passageToDTO(passage).annotations ?? []) : [];
  });
};

describe('stack annotation save contract', () => {
  const stored = FIXTURES.flatMap((dto) => dto.annotations ?? []);

  const covered = (
    Object.keys(ANNOTATION_TYPE_DTO_TO_TYPE) as AnnotationDTOType[]
  )
    .filter((type) => !ANNOTATIONS_TO_IGNORE.includes(type))
    .filter((type) => type !== 'unknown');

  it.each(covered)('has a fixture for every key %s models', (type) => {
    const rows = stored.filter((a) => a.type === type);
    expect(rows.length).toBeGreaterThan(0);

    const fixtureKeys = new Set(
      rows.flatMap((a) => Object.keys(merged(a.content))),
    );
    const skipped = NOT_MODELLED[type] ?? [];
    const missing = keysRead(type).filter(
      (key) => !skipped.includes(key) && !fixtureKeys.has(key),
    );
    expect(missing).toEqual([]);
  });

  it('keeps every modelled key of every stored row through load and save', async () => {
    const saved = await loadAndSave(FIXTURES);
    const byUuid = new Map(saved.map((a) => [a.uuid, a]));

    const shape = (row: AnnotationDTO | undefined) =>
      row && {
        uuid: row.uuid,
        type: row.type,
        start: row.start,
        end: row.end,
        toh: row.toh,
        content: merged(row.content),
      };

    expect(stored.map((before) => shape(byUuid.get(before.uuid)))).toEqual(
      stored.map(shape),
    );
  });
});
