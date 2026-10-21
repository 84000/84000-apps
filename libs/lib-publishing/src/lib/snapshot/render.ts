/**
 * Renders a work's draft rows as a file tree an agent can read like a repository. Pure:
 * rows in, `path -> text` out.
 *
 * Invariants:
 * - one passage, term or bibliography entry per line, each starting `[<anchor>…]`;
 * - every anchor is unique within the work and resolves to a uuid through `anchors.tsv`;
 * - text is normalized (see `normalize.ts`); annotation offsets index the stored text,
 *   which `raw/passages.jsonl` carries unchanged.
 */

import { sha256 } from '../serialize';
import { MIN_ANCHOR_HEX } from './anchors';
import {
  bibliographyAnchors,
  body,
  glossaryAnchors,
  passageAnchors,
  renderAnchors,
  renderAnnotationFiles,
  renderBibliographyFile,
  renderGlossaryFiles,
  renderPassageText,
  renderRawPassages,
} from './parts';
import type { DraftRows } from './read-draft';

/** Bumped when the layout changes, so stored snapshots in an older format are refreshed. */
export const SNAPSHOT_FORMAT_VERSION = 2;

export type SnapshotTree = Map<string, string>;

export interface SnapshotFile {
  path: string;
  bytes: number;
  lines: number;
  sha256: string;
}

export interface SnapshotCounts {
  passages: number;
  annotations: number;
  glossaryInstances: number;
  otherAnnotations: number;
  layoutAnnotations: number;
  glossaryTerms: number;
  bibliographies: number;
  alignments: number;
  alignedPassages: number;
  /** Anchors longer than the minimum because their uuid prefix collided. */
  lengthenedAnchors: number;
}

export interface SnapshotManifest {
  formatVersion: number;
  workUuid: string;
  tohs: string[];
  title: string | null;
  source: 'draft';
  /** The draft state the snapshot was built from. */
  draftTouchedAt: string | null;
  generatedAt: string;
  counts: SnapshotCounts;
  totals: { files: number; bytes: number; lines: number };
  /** Every file but `manifest.json` itself. */
  files: SnapshotFile[];
}

export interface RenderedSnapshot {
  tree: SnapshotTree;
  manifest: SnapshotManifest;
  /** Anchor to uuid, for passages, glossary terms and bibliography entries. */
  anchors: Map<string, string>;
}

const readme = (
  rows: DraftRows,
  generatedAt: string,
  counts: SnapshotCounts,
  paths: string[],
): string => {
  const { work } = rows;
  return body([
    `# ${work.title ?? work.tohs.join(', ')} (${work.tohs.join(', ')})`,
    '',
    `Snapshot of the DRAFT, generated ${generatedAt} from the draft as of ${work.draftTouchedAt ?? 'unknown'}.`,
    'Read-only. The studio write tools take uuids: resolve an anchor to its uuid with `anchors.tsv`.',
    '',
    '## Conventions',
    '- One passage per line, starting `[p-<id> <label>]`; headings add `## `.',
    `- Anchors are the first ${MIN_ANCHOR_HEX} hex digits of the uuid, longer only where two would collide. \`anchors.tsv\` maps each to its uuid, file and line.`,
    '- `[^n.12]` marks where endnote n.12 attaches; the note itself is in `notes.md`. Where two notes share a label, the marker adds the note anchor: `[^n.12 p-<id>]`.',
    '- `tibetan/` mirrors `text/` for aligned passages, with folios and the same anchors.',
    '- `glossary.md`: one term per line, `[g-<id> #<n>] en: … | alt: … | bo: … | wylie: … | sa: … | def: …`.',
    '- `bibliography.md`: one entry per line, `[b-<id>]`; headings add `## `.',
    '- `annotations/glossary-instances.tsv`: every glossary instance with the text it covers.',
    '- `annotations/annotations.jsonl`: every other non-layout annotation; `layout.jsonl` holds lines, paragraphs and headings.',
    '- Soft hyphens are removed; line breaks become spaces (Tibetan folio line breaks are dropped). Annotation `start`/`end` are offsets into the stored passage text, which may still contain soft hyphens; `text` is the normalized span.',
    '- `raw/passages.jsonl`: one passage per line, `{"uuid", "anchor", "content"}`, in reading order, with `content` exactly as stored. Offsets for the write tools index this text. `raw/glossary.jsonl`: one term per line, `{"uuid", "authority", "anchor", "english", "alternatives"}`, as stored. For scripts; `work-grep` skips `raw/` unless its `path` names it.',
    '',
    '## Counts',
    ...Object.entries(counts).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Files',
    ...paths.map((p) => `- ${p}`),
  ]);
};

/** Renders the tree. `generatedAt` is an input so the output is deterministic. */
export const renderSnapshotTree = ({
  rows,
  generatedAt,
}: {
  rows: DraftRows;
  generatedAt: string;
}): RenderedSnapshot => {
  const { work, passages, annotations, glossary, bibliographies, alignments } =
    rows;
  const tree: SnapshotTree = new Map();

  const passageText = renderPassageText({
    passages,
    noteLinks: annotations,
    alignments,
  });
  const annotationFiles = renderAnnotationFiles({
    passages,
    annotations,
    glossary,
    glossaryTermOf: rows.glossaryTermOf,
  });
  const anchorFiles = renderAnchors({
    passages,
    passageLocation: passageText.location,
    glossary,
    bibliographies,
  });
  const glossaryFiles = renderGlossaryFiles(glossary);
  const anchors = anchorFiles.anchors;

  for (const [path, content] of passageText.files) tree.set(path, content);
  tree.set('glossary.md', glossaryFiles.get('glossary.md') ?? '');
  for (const [path, content] of renderBibliographyFile(bibliographies)) {
    tree.set(path, content);
  }
  for (const [path, content] of anchorFiles.files) tree.set(path, content);
  for (const [path, content] of annotationFiles.files) tree.set(path, content);
  for (const [path, content] of renderRawPassages(passages)) {
    tree.set(path, content);
  }
  tree.set('raw/glossary.jsonl', glossaryFiles.get('raw/glossary.jsonl') ?? '');
  if (!tree.has('notes.md')) tree.set('notes.md', '');

  const pAnchor = passageAnchors(passages);
  const gAnchor = glossaryAnchors(glossary);
  const bAnchor = bibliographyAnchors(bibliographies);
  const passageUuids = new Set(passages.map((p) => p.uuid));
  const lengthened = [
    ...pAnchor.values(),
    ...gAnchor.values(),
    ...bAnchor.values(),
  ].filter((a) => a.slice(a.indexOf('-') + 1).length > MIN_ANCHOR_HEX).length;
  const counts: SnapshotCounts = {
    passages: passages.length,
    annotations: annotations.length,
    ...annotationFiles.counts,
    glossaryTerms: glossary.length,
    bibliographies: bibliographies.length,
    alignments: alignments.length,
    alignedPassages: new Set(
      alignments
        .map((a) => a.passage_uuid)
        .filter((uuid) => passageUuids.has(uuid)),
    ).size,
    lengthenedAnchors: lengthened,
  };

  const paths = [...tree.keys(), 'README.md', 'manifest.json'].sort();
  tree.set('README.md', readme(rows, generatedAt, counts, paths));

  const entries = [...tree.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([path, text]) => ({
      path,
      bytes: Buffer.byteLength(text, 'utf8'),
      lines: text ? text.split('\n').length - 1 : 0,
      sha256: sha256(text),
    }));
  const manifest: SnapshotManifest = {
    formatVersion: SNAPSHOT_FORMAT_VERSION,
    workUuid: work.uuid,
    tohs: work.tohs,
    title: work.title,
    source: 'draft',
    draftTouchedAt: work.draftTouchedAt,
    generatedAt,
    counts,
    totals: {
      files: entries.length,
      bytes: entries.reduce((n, f) => n + f.bytes, 0),
      lines: entries.reduce((n, f) => n + f.lines, 0),
    },
    files: entries,
  };
  tree.set('manifest.json', JSON.stringify(manifest, null, 2) + '\n');

  return { tree, manifest, anchors };
};
