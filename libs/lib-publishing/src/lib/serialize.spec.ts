import {
  PASSAGE_CHUNK_CHAR_BUDGET,
  PASSAGE_CHUNK_MAX_ROWS,
  buildPassageIndex,
  chunkRangeFor,
  fileEntry,
  sha256,
  splitPassagesIntoChunks,
} from './serialize';
import type { PublishedPassage } from './types';

const passage = (
  overrides: Partial<PublishedPassage> & { uuid: string },
): PublishedPassage => ({
  work_uuid: 'w-1',
  content: 'Thus have I heard.',
  label: '1.1',
  sort: 1,
  parent: null,
  type: 'translation-paragraph',
  toh: 'toh999',
  ...overrides,
});

const filler = (uuid: string, sort: number, chars: number) =>
  passage({ uuid, sort, content: 'x'.repeat(chars) });

describe('splitPassagesIntoChunks', () => {
  it('returns everything as remainder when under budget', () => {
    const { chunks, remainder } = splitPassagesIntoChunks([
      passage({ uuid: 'a', sort: 1 }),
      passage({ uuid: 'b', sort: 2 }),
    ]);

    expect(chunks).toEqual([]);
    expect(remainder).toHaveLength(2);
  });

  it('cuts a chunk once the character budget is exceeded', () => {
    const half = PASSAGE_CHUNK_CHAR_BUDGET / 2 + 1;
    const { chunks, remainder } = splitPassagesIntoChunks([
      filler('a', 1, half),
      filler('b', 2, half),
      filler('c', 3, half),
    ]);

    expect(chunks).toHaveLength(2);
    expect(remainder.map((p) => p.uuid)).toEqual(['c']);
  });

  it('never overshoots the budget once a chunk has content', () => {
    const fifth = PASSAGE_CHUNK_CHAR_BUDGET / 5;
    const { chunks } = splitPassagesIntoChunks(
      Array.from({ length: 12 }, (_, i) => filler(`p-${i}`, i, fifth)),
    );

    for (const chunk of chunks) {
      const total = chunk.reduce((sum, p) => sum + (p.content?.length ?? 0), 0);
      expect(total).toBeLessThanOrEqual(PASSAGE_CHUNK_CHAR_BUDGET);
    }
  });

  it('keeps an oversized single passage rather than dropping it', () => {
    const { chunks, remainder } = splitPassagesIntoChunks([
      filler('huge', 1, PASSAGE_CHUNK_CHAR_BUDGET * 3),
    ]);

    expect(chunks).toEqual([]);
    expect(remainder).toHaveLength(1);
    expect(remainder[0].content).toHaveLength(PASSAGE_CHUNK_CHAR_BUDGET * 3);
  });

  it('caps rows per chunk for many short passages', () => {
    const { chunks } = splitPassagesIntoChunks(
      Array.from({ length: PASSAGE_CHUNK_MAX_ROWS + 50 }, (_, i) =>
        passage({ uuid: `p-${i}`, sort: i, content: 'a' }),
      ),
    );

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toHaveLength(PASSAGE_CHUNK_MAX_ROWS);
  });

  // Chunks are cut by character budget while rows arrive in 1000-row pages, so the
  // boundaries do not align. Carrying the remainder into the next page is what stops an
  // undersized chunk being emitted at every page boundary.
  it('supports carrying a remainder across pages without losing rows', () => {
    const third = PASSAGE_CHUNK_CHAR_BUDGET / 3;
    const pageOne = [filler('a', 1, third), filler('b', 2, third)];
    const pageTwo = [filler('c', 3, third), filler('d', 4, third)];

    const first = splitPassagesIntoChunks(pageOne);
    const second = splitPassagesIntoChunks([...first.remainder, ...pageTwo]);

    const emitted = [
      ...first.chunks.flat(),
      ...second.chunks.flat(),
      ...second.remainder,
    ].map((p) => p.uuid);

    expect(emitted).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles null content as zero characters', () => {
    const { remainder } = splitPassagesIntoChunks([
      passage({ uuid: 'a', sort: 1, content: null }),
    ]);
    expect(remainder).toHaveLength(1);
  });
});

describe('buildPassageIndex', () => {
  const ranges = [
    chunkRangeFor({
      path: 'passages/chunk-0001.json',
      passages: [passage({ uuid: 'a', sort: 1 }), passage({ uuid: 'b', sort: 2 })],
    }),
    chunkRangeFor({
      path: 'passages/chunk-0002.json',
      passages: [passage({ uuid: 'c', sort: 3 }), passage({ uuid: 'd', sort: 4 })],
    }),
  ];

  const rows = [
    { uuid: 'a', sort: 1, type: 'p', charCount: 10 },
    { uuid: 'b', sort: 2, type: 'p', charCount: 20 },
    { uuid: 'c', sort: 3, type: 'p', charCount: 30 },
    { uuid: 'd', sort: 4, type: 'p', charCount: 40 },
  ];

  it('points every passage at the chunk that holds it', () => {
    const entries = buildPassageIndex({ rows, ranges });

    expect(entries.map((e) => e.chunkRef)).toEqual([
      'passages/chunk-0001.json',
      'passages/chunk-0001.json',
      'passages/chunk-0002.json',
      'passages/chunk-0002.json',
    ]);
  });

  it('numbers sequences from one, in order', () => {
    const entries = buildPassageIndex({ rows, ranges });
    expect(entries.map((e) => e.sequence)).toEqual([1, 2, 3, 4]);
  });

  it('carries the char count the reader paginates on', () => {
    const entries = buildPassageIndex({ rows, ranges });
    expect(entries.map((e) => e.charCount)).toEqual([10, 20, 30, 40]);
  });

  it('is order-independent with respect to the recorded ranges', () => {
    const entries = buildPassageIndex({ rows, ranges: [...ranges].reverse() });
    expect(entries.map((e) => e.chunkRef)).toEqual([
      'passages/chunk-0001.json',
      'passages/chunk-0001.json',
      'passages/chunk-0002.json',
      'passages/chunk-0002.json',
    ]);
  });

  it('lets the reader reproduce a page from the index alone', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({
      uuid: `p-${i}`,
      sort: i,
      type: 'p',
      charCount: 1000,
    }));
    const entries = buildPassageIndex({
      rows: many,
      ranges: [
        chunkRangeFor({
          path: 'passages/chunk-0001.json',
          passages: many.map((r) => passage({ uuid: r.uuid, sort: r.sort })),
        }),
      ],
    });

    // The reader's defaults: 20 passages or 50000 characters, whichever binds first.
    let chars = 0;
    const page = [];
    for (const entry of entries) {
      if (page.length >= 20 || chars + entry.charCount > 50_000) break;
      page.push(entry);
      chars += entry.charCount;
    }

    expect(page).toHaveLength(20);
  });

  it('treats a null sort as zero so index building stays total', () => {
    const entries = buildPassageIndex({
      rows: [{ uuid: 'a', sort: null, type: null, charCount: 0 }],
      ranges: [
        chunkRangeFor({
          path: 'passages/chunk-0001.json',
          passages: [passage({ uuid: 'a', sort: null })],
        }),
      ],
    });

    expect(entries[0].chunkRef).toBe('passages/chunk-0001.json');
  });
});

describe('fileEntry', () => {
  it('records checksum, byte length, and row count', () => {
    const entry = fileEntry({ path: 'a.json', body: '{"a":1}', rowCount: 3 });

    expect(entry.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(entry.byteLength).toBe(7);
    expect(entry.rowCount).toBe(3);
  });

  it('measures bytes rather than characters for multi-byte content', () => {
    // Tibetan content is routine here, so a length-vs-bytes mistake would be systematic.
    const entry = fileEntry({ path: 'a.json', body: 'བྱང', rowCount: 1 });
    expect(entry.byteLength).toBeGreaterThan('བྱང'.length);
  });
});

describe('sha256', () => {
  it('is stable and content-sensitive', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });
});
