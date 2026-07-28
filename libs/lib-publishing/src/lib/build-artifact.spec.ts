import {
  PASSAGE_CHUNK_CHAR_BUDGET,
  PASSAGE_CHUNK_MAX_ROWS,
  buildArtifact,
} from './build-artifact';
import { annotation, draftWork, passage, VERSION_UUID } from './test-fixtures';
import type { ArtifactFile, PassageIndexEntry } from './types';

const build = (draft = draftWork()) =>
  buildArtifact({
    draft,
    versionUuid: VERSION_UUID,
    version: '0.0.1',
    createdAt: '2026-07-28T00:00:00.000Z',
    warnings: [],
  });

const file = (files: ArtifactFile[], path: string) =>
  files.find((f) => f.path === path);

const parse = <T>(files: ArtifactFile[], path: string): T => {
  const found = file(files, path);
  if (!found) throw new Error(`missing artifact file ${path}`);
  return JSON.parse(found.body) as T;
};

describe('buildArtifact', () => {
  it('writes the expected artifact layout', () => {
    const { files } = build();
    const paths = files.map((f) => f.path).sort();

    expect(paths).toEqual([
      'annotations/chunk-0001.json',
      'bibliography.json',
      'glossary/chunk-0001.json',
      'glossary/index.json',
      'manifest.json',
      'metadata.json',
      'passages/chunk-0001.json',
      'passages/index.json',
    ]);
  });

  it('omits alignment chunks when a work has none', () => {
    const { files } = build();
    expect(files.some((f) => f.path.startsWith('alignments/'))).toBe(false);
  });

  describe('passage index', () => {
    it('carries sequence, uuid, char count, and chunk ref per passage', () => {
      const { files } = build();
      const index = parse<{ passages: PassageIndexEntry[] }>(
        files,
        'passages/index.json',
      );

      expect(index.passages[0]).toEqual({
        sequence: 1,
        uuid: 'aaaaaaa1-0000-4000-8000-000000000001',
        charCount: 'Thus have I heard.'.length,
        chunkRef: 'passages/chunk-0001.json',
        type: 'translation-paragraph',
        sort: 1,
      });
    });

    it('numbers sequences in published sort order, not input order', () => {
      const draft = draftWork({
        passages: [
          passage({ uuid: 'p-late', sort: 9 }),
          passage({ uuid: 'p-early', sort: 1 }),
        ],
        annotations: [],
      });

      const index = parse<{ passages: PassageIndexEntry[] }>(
        build(draft).files,
        'passages/index.json',
      );

      expect(index.passages.map((p) => p.uuid)).toEqual(['p-early', 'p-late']);
      expect(index.passages.map((p) => p.sequence)).toEqual([1, 2]);
    });

    it('lets the reader reproduce a page from the index alone', () => {
      const draft = draftWork({
        passages: Array.from({ length: 30 }, (_, i) =>
          passage({ uuid: `p-${i}`, sort: i, content: 'x'.repeat(1000) }),
        ),
        annotations: [],
      });

      const index = parse<{ passages: PassageIndexEntry[] }>(
        build(draft).files,
        'passages/index.json',
      );

      // The reader's defaults: 20 passages or 50000 characters, whichever binds first.
      let chars = 0;
      const page: PassageIndexEntry[] = [];
      for (const entry of index.passages) {
        if (page.length >= 20 || chars + entry.charCount > 50_000) break;
        page.push(entry);
        chars += entry.charCount;
      }

      expect(page).toHaveLength(20);
      expect(new Set(page.map((p) => p.chunkRef)).size).toBeGreaterThan(0);
    });
  });

  describe('chunking', () => {
    it('splits passages once the char budget is exceeded', () => {
      const perPassage = PASSAGE_CHUNK_CHAR_BUDGET / 2 + 1;
      const draft = draftWork({
        passages: [0, 1, 2].map((i) =>
          passage({ uuid: `p-${i}`, sort: i, content: 'x'.repeat(perPassage) }),
        ),
        annotations: [],
      });

      const { files } = build(draft);
      const chunks = files.filter((f) => f.path.startsWith('passages/chunk-'));

      expect(chunks).toHaveLength(3);
    });

    it('never overshoots the budget when a chunk already has content', () => {
      const draft = draftWork({
        passages: Array.from({ length: 12 }, (_, i) =>
          passage({
            uuid: `p-${i}`,
            sort: i,
            content: 'x'.repeat(PASSAGE_CHUNK_CHAR_BUDGET / 5),
          }),
        ),
        annotations: [],
      });

      const { files } = build(draft);
      const chunks = files.filter((f) => f.path.startsWith('passages/chunk-'));

      for (const chunk of chunks) {
        const parsed = JSON.parse(chunk.body) as {
          passages: { content: string | null }[];
        };
        const total = parsed.passages.reduce(
          (sum, p) => sum + (p.content?.length ?? 0),
          0,
        );
        // A single oversized passage is allowed to exceed the budget alone.
        if (parsed.passages.length > 1) {
          expect(total).toBeLessThanOrEqual(PASSAGE_CHUNK_CHAR_BUDGET);
        }
      }
    });

    it('keeps an oversized single passage rather than dropping it', () => {
      const draft = draftWork({
        passages: [
          passage({
            uuid: 'huge',
            sort: 1,
            content: 'x'.repeat(PASSAGE_CHUNK_CHAR_BUDGET * 3),
          }),
        ],
        annotations: [],
      });

      const index = parse<{ passages: PassageIndexEntry[] }>(
        build(draft).files,
        'passages/index.json',
      );

      expect(index.passages).toHaveLength(1);
      expect(index.passages[0].charCount).toBe(PASSAGE_CHUNK_CHAR_BUDGET * 3);
    });

    it('caps rows per chunk for many short passages', () => {
      const draft = draftWork({
        passages: Array.from({ length: PASSAGE_CHUNK_MAX_ROWS + 50 }, (_, i) =>
          passage({ uuid: `p-${i}`, sort: i, content: 'a' }),
        ),
        annotations: [],
      });

      const { files } = build(draft);
      const chunks = files.filter((f) => f.path.startsWith('passages/chunk-'));

      expect(chunks).toHaveLength(2);
      expect(chunks[0].rowCount).toBe(PASSAGE_CHUNK_MAX_ROWS);
    });

    it('points every index entry at the chunk that actually holds it', () => {
      const draft = draftWork({
        passages: Array.from({ length: 5 }, (_, i) =>
          passage({
            uuid: `p-${i}`,
            sort: i,
            content: 'x'.repeat(PASSAGE_CHUNK_CHAR_BUDGET),
          }),
        ),
        annotations: [],
      });

      const { files } = build(draft);
      const index = parse<{ passages: PassageIndexEntry[] }>(
        files,
        'passages/index.json',
      );

      for (const entry of index.passages) {
        const chunk = parse<{ passages: { uuid: string }[] }>(
          files,
          entry.chunkRef,
        );
        expect(chunk.passages.map((p) => p.uuid)).toContain(entry.uuid);
      }
    });
  });

  describe('annotations', () => {
    it('excludes deprecated types, matching the reader', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'keep',
          passage_uuid: draft.passages[0].uuid,
        }),
        annotation({
          uuid: 'drop',
          passage_uuid: draft.passages[0].uuid,
          type: 'deprecated-reference',
        }),
      ];

      const chunk = parse<{ annotations: { uuid: string }[] }>(
        build(draft).files,
        'annotations/chunk-0001.json',
      );

      expect(chunk.annotations.map((a) => a.uuid)).toEqual(['keep']);
    });

    it('strips *_xmlId keys from published content', () => {
      const draft = draftWork();
      draft.annotations = [
        annotation({
          uuid: 'a-1',
          passage_uuid: draft.passages[0].uuid,
          type: 'glossary-instance',
          content: [
            {
              type: 'glossary',
              uuid: draft.glossary[0].glossary_uuid,
              glossary_xmlId: 'UT22084-051-001-3225',
            },
          ],
        }),
      ];

      const chunk = parse<{ annotations: { content: unknown }[] }>(
        build(draft).files,
        'annotations/chunk-0001.json',
      );

      expect(JSON.stringify(chunk.annotations[0].content)).not.toContain('xmlId');
      expect(chunk.annotations[0].content).toEqual([
        { type: 'glossary', uuid: draft.glossary[0].glossary_uuid },
      ]);
    });
  });

  describe('manifest', () => {
    it('records a checksum, byte length, and row count per file', () => {
      const { manifest, files } = build();
      const entry = manifest.files.find(
        (f) => f.path === 'passages/index.json',
      );

      expect(entry?.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(entry?.byteLength).toBeGreaterThan(0);
      expect(entry?.rowCount).toBe(2);
      // The manifest lists every file except itself.
      expect(manifest.files).toHaveLength(files.length - 1);
    });

    it('records section counts', () => {
      const { manifest } = build();
      expect(manifest.counts).toEqual({
        passages: 2,
        annotations: 1,
        glossary: 1,
        bibliography: 1,
        alignments: 0,
        metadata: 1,
      });
    });

    it('is deterministic for identical input', () => {
      const first = build(draftWork());
      const second = build(draftWork());
      expect(first.manifestHash).toBe(second.manifestHash);
    });

    it('changes when content changes', () => {
      const changed = draftWork();
      changed.passages[0].content = 'Different words entirely.';
      expect(build().manifestHash).not.toBe(build(changed).manifestHash);
    });

    it('carries validation warnings for the audit trail', () => {
      const { manifest } = buildArtifact({
        draft: draftWork(),
        versionUuid: VERSION_UUID,
        version: '0.0.1',
        createdAt: '2026-07-28T00:00:00.000Z',
        warnings: [
          { severity: 'warning', rule: 'toh-missing', message: 'No toh.' },
        ],
      });

      expect(manifest.warnings).toHaveLength(1);
      expect(manifest.warnings[0].rule).toBe('toh-missing');
    });
  });
});
