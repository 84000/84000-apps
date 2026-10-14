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

import type { PublishedAnnotation, PublishedGlossaryTerm } from '../types';
import { sha256 } from '../serialize';
import { makeAnchors, MIN_ANCHOR_HEX } from './anchors';
import {
  htmlToText,
  normalizeText,
  normalizeTibetan,
  tsvRow,
} from './normalize';
import type { DraftAlignment, DraftRows } from './read-draft';

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

/** Passage-type sections in reading order. Unknown types land in `99-other`. */
const SECTIONS: { stem: string; types: string[] }[] = [
  { stem: '00-summary', types: ['summary'] },
  { stem: '01-acknowledgment', types: ['acknowledgment'] },
  { stem: '02-introduction', types: ['introduction'] },
  { stem: '03-prologue', types: ['homage', 'prelude', 'prologue'] },
  { stem: '04-translation', types: ['translation'] },
  { stem: '05-colophon', types: ['colophon'] },
  { stem: '06-appendix', types: ['appendix'] },
  { stem: '07-abbreviations', types: ['abbreviations'] },
];
const TRANSLATION = '04-translation';

/** Annotation types that only describe layout. */
const LAYOUT_TYPES = new Set([
  'line',
  'line-group',
  'paragraph',
  'leading-space',
  'indent',
  'heading',
  'trailer',
]);

const baseType = (type: string | null): string =>
  (type ?? '').replace(/Header$/, '');
const isHeader = (type: string | null): boolean => !!type?.endsWith('Header');
const isChapterHeader = (type: string | null, label: string | null) =>
  type === 'translationHeader' && /^\d+\.$/.test(label ?? '');

const slug = (text: string): string =>
  text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'chapter';

const body = (lines: string[]): string =>
  lines.length ? lines.join('\n') + '\n' : '';

const contentUuid = (content: unknown): string | undefined => {
  if (!Array.isArray(content)) return undefined;
  for (const item of content) {
    if (item && typeof item === 'object' && 'uuid' in item) {
      return String((item as { uuid: unknown }).uuid);
    }
  }
  return undefined;
};

/** Inserts `[^n.12]` markers at note-link offsets, right to left. */
const withNoteMarkers = (
  content: string,
  links: { offset: number; label: string }[],
): string => {
  let text = content;
  for (const link of [...links].sort((a, b) => b.offset - a.offset)) {
    const at = Math.max(0, Math.min(text.length, link.offset));
    text = `${text.slice(0, at)}[^${link.label}]${text.slice(at)}`;
  }
  return text;
};

const line = (anchor: string, label: string | null, text: string): string => {
  // A label cannot end the bracket early or break the line.
  const safe = normalizeText(label).replace(/\]/g, ')').trim();
  const head = `[${anchor}${safe ? ` ${safe}` : ''}]`;
  return text ? `${head} ${text}` : head;
};

const folioRef = (rows: DraftAlignment[]): string => {
  const folios = rows
    .map((r) => r.folio_number)
    .filter((n): n is number => n !== null);
  if (!folios.length) return '';
  const first = Math.min(...folios);
  const last = Math.max(...folios);
  return first === last ? `F.${first}` : `F.${first}–${last}`;
};

const termLine = (anchor: string, term: PublishedGlossaryTerm): string => {
  const fields: [string, string | null][] = [
    ['en', term.english],
    [
      'hw',
      term.headword?.toLowerCase() !== term.english?.toLowerCase()
        ? term.headword
        : null,
    ],
    ['alt', term.alternatives],
    ['bo', term.tibetan],
    ['wylie', term.wylie],
    ['sa', term.sanskrit_attested ?? term.sanskrit_plain],
    ['pi', term.pali],
    ['zh', term.chinese],
    ['def', term.definition ? htmlToText(term.definition) : null],
  ];
  const text = fields
    .map(([key, value]) => [key, normalizeText(value)] as const)
    .filter(([, value]) => value.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join(' | ');
  return line(anchor, `#${term.term_number ?? '?'}`, text);
};

const groupBy = <T>(items: T[], key: (item: T) => string): Map<string, T[]> => {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
};

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

  const pAnchor = makeAnchors(
    passages.map((p) => p.uuid),
    'p',
  );
  const gAnchor = makeAnchors(
    glossary.map((g) => g.glossary_uuid),
    'g',
  );
  const bAnchor = makeAnchors(
    bibliographies.map((b) => b.uuid),
    'b',
  );
  const anchorOf = (map: Map<string, string>, uuid: string) =>
    map.get(uuid) ?? uuid;

  const passageByUuid = new Map(passages.map((p) => [p.uuid, p]));
  const annotationsByPassage = groupBy(annotations, (a) => a.passage_uuid);
  const alignmentsByPassage = groupBy(alignments, (a) => a.passage_uuid);
  const hasChapters = passages.some((p) => isChapterHeader(p.type, p.label));

  // A note reference is its label, plus the note's anchor when labels repeat (one set
  // of notes per Toh in a multi-Toh work).
  const noteLabels = groupBy(
    passages.filter((p) => baseType(p.type) === 'endnotes' && p.label),
    (p) => p.label as string,
  );
  const noteRef = (uuid: string | undefined): string => {
    const note = passageByUuid.get(uuid ?? '');
    if (!note?.label) return '?';
    return (noteLabels.get(note.label)?.length ?? 0) > 1
      ? `${note.label} ${anchorOf(pAnchor, note.uuid)}`
      : note.label;
  };

  const raw = passages.map((p) =>
    JSON.stringify({
      uuid: p.uuid,
      anchor: anchorOf(pAnchor, p.uuid),
      content: p.content ?? '',
    }),
  );

  const files = new Map<string, string[]>();
  const location = new Map<string, { path: string; line: number }>();
  const push = (path: string, text: string): number => {
    const lines = files.get(path) ?? [];
    lines.push(text);
    files.set(path, lines);
    return lines.length;
  };

  let chapterPath = `text/${TRANSLATION}/000-opening.md`;
  let chapter = 0;
  for (const passage of passages) {
    const type = baseType(passage.type);
    let path: string;
    if (type === 'endnotes') {
      path = 'notes.md';
    } else if (type === 'translation' && hasChapters) {
      if (isChapterHeader(passage.type, passage.label)) {
        chapter += 1;
        const name = slug(normalizeText(passage.content));
        chapterPath = `text/${TRANSLATION}/${String(chapter).padStart(3, '0')}-${name}.md`;
      }
      path = chapterPath;
    } else {
      const stem =
        SECTIONS.find((s) => s.types.includes(type))?.stem ?? '99-other';
      path = `text/${stem}.md`;
    }

    const anchor = anchorOf(pAnchor, passage.uuid);
    const notes = (annotationsByPassage.get(passage.uuid) ?? [])
      .filter((a) => a.type === 'end-note-link')
      .map((a) => ({
        offset: a.start,
        label: noteRef(contentUuid(a.content)),
      }));
    const text = normalizeText(withNoteMarkers(passage.content ?? '', notes));
    const at = push(
      path,
      line(anchor, passage.label, isHeader(passage.type) ? `## ${text}` : text),
    );
    location.set(passage.uuid, { path, line: at });

    const aligned = alignmentsByPassage.get(passage.uuid);
    if (aligned?.length && path.startsWith('text/')) {
      const tibetan = aligned
        .map((a) => normalizeTibetan(a.tibetan))
        .filter((t) => t.trim())
        .join(' ');
      push(
        path.replace(/^text\//, 'tibetan/'),
        line(anchor, passage.label, `${folioRef(aligned)} ${tibetan}`.trim()),
      );
    }
  }

  const rawGlossary = glossary.map((g) =>
    JSON.stringify({
      uuid: g.glossary_uuid,
      authority: g.authority_uuid,
      anchor: anchorOf(gAnchor, g.glossary_uuid),
      english: g.english,
      alternatives: g.alternatives,
    }),
  );
  const glossaryLines = glossary.map((g, i) => {
    location.set(g.glossary_uuid, { path: 'glossary.md', line: i + 1 });
    return termLine(anchorOf(gAnchor, g.glossary_uuid), g);
  });
  const bibliographyLines = bibliographies.map((b, i) => {
    location.set(b.uuid, { path: 'bibliography.md', line: i + 1 });
    const text = b.is_heading
      ? `## ${htmlToText(b.heading ?? b.bibl_html)}`
      : htmlToText(b.bibl_html);
    return line(anchorOf(bAnchor, b.uuid), null, text);
  });

  // Annotations, in reading order.
  const termByUuid = new Map(glossary.map((g) => [g.glossary_uuid, g]));
  const instances = [
    tsvRow([
      'term',
      'term_en',
      'passage',
      'label',
      'start',
      'end',
      'text',
      'uuid',
    ]),
  ];
  const other: string[] = [];
  const layout: string[] = [];
  for (const passage of passages) {
    const list = [...(annotationsByPassage.get(passage.uuid) ?? [])].sort(
      (a, b) =>
        a.start - b.start || a.end - b.end || a.uuid.localeCompare(b.uuid),
    );
    for (const a of list as PublishedAnnotation[]) {
      const text = normalizeText((passage.content ?? '').slice(a.start, a.end));
      const anchor = anchorOf(pAnchor, passage.uuid);
      if (a.type === 'glossary-instance') {
        const cited = contentUuid(a.content) ?? '';
        const termUuid = rows.glossaryTermOf.get(cited) ?? cited;
        instances.push(
          tsvRow([
            gAnchor.get(termUuid) ?? `unresolved:${termUuid}`,
            termByUuid.get(termUuid)?.english,
            anchor,
            passage.label,
            a.start,
            a.end,
            text,
            a.uuid,
          ]),
        );
        continue;
      }
      const record = JSON.stringify({
        passage: anchor,
        label: passage.label,
        type: a.type,
        start: a.start,
        end: a.end,
        ...(a.end > a.start ? { text } : {}),
        content: a.content,
        uuid: a.uuid,
      });
      (LAYOUT_TYPES.has(a.type) ? layout : other).push(record);
    }
  }

  const anchors = new Map<string, string>();
  const anchorRows = [
    tsvRow(['anchor', 'uuid', 'kind', 'label', 'type', 'sort', 'file', 'line']),
  ];
  const addAnchors = (
    kind: string,
    map: Map<string, string>,
    rowsOf: {
      uuid: string;
      label: string | number | null;
      type: string | null;
      sort: number | null;
    }[],
  ) => {
    for (const r of rowsOf) {
      const anchor = anchorOf(map, r.uuid);
      anchors.set(anchor, r.uuid);
      const loc = location.get(r.uuid);
      anchorRows.push(
        tsvRow([
          anchor,
          r.uuid,
          kind,
          r.label,
          r.type,
          r.sort,
          loc?.path,
          loc?.line,
        ]),
      );
    }
  };
  addAnchors('passage', pAnchor, passages);
  addAnchors(
    'glossary',
    gAnchor,
    glossary.map((g) => ({
      uuid: g.glossary_uuid,
      label: g.term_number,
      type: 'term',
      sort: g.term_number,
    })),
  );
  addAnchors(
    'bibliography',
    bAnchor,
    bibliographies.map((b) => ({
      uuid: b.uuid,
      label: null,
      type: b.is_heading ? 'heading' : 'entry',
      sort: b.sort,
    })),
  );

  for (const [path, lines] of files) tree.set(path, body(lines));
  tree.set('glossary.md', body(glossaryLines));
  tree.set('bibliography.md', body(bibliographyLines));
  tree.set('anchors.tsv', body(anchorRows));
  tree.set('annotations/glossary-instances.tsv', body(instances));
  tree.set('annotations/annotations.jsonl', body(other));
  tree.set('annotations/layout.jsonl', body(layout));
  tree.set('raw/passages.jsonl', body(raw));
  tree.set('raw/glossary.jsonl', body(rawGlossary));
  if (!tree.has('notes.md')) tree.set('notes.md', '');

  const lengthened = [
    ...pAnchor.values(),
    ...gAnchor.values(),
    ...bAnchor.values(),
  ].filter((a) => a.slice(a.indexOf('-') + 1).length > MIN_ANCHOR_HEX).length;
  const counts: SnapshotCounts = {
    passages: passages.length,
    annotations: annotations.length,
    glossaryInstances: instances.length - 1,
    otherAnnotations: other.length,
    layoutAnnotations: layout.length,
    glossaryTerms: glossary.length,
    bibliographies: bibliographies.length,
    alignments: alignments.length,
    alignedPassages: [...alignmentsByPassage.keys()].filter((uuid) =>
      passageByUuid.has(uuid),
    ).length,
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
