/**
 * The parts of a work's snapshot, each rendered from only the rows it needs. Pure: rows
 * in, `path -> text` out.
 *
 * `renderSnapshotTree` joins every part into the stored work snapshot; the `work.*`
 * snapshot layers each render one part. Both go through these functions, so a bundle of
 * every work layer holds the same files as the stored snapshot.
 *
 * Paths are relative to the work's root. Anchors depend only on the uuids of their own
 * kind (see `anchors.ts`), so each part computes the anchors it prints and they agree
 * across parts.
 */

import type {
  PublishedAnnotation,
  PublishedBibliography,
  PublishedGlossaryTerm,
  PublishedPassage,
} from '../types';
import { makeAnchors } from './anchors';
import {
  htmlToText,
  normalizeText,
  normalizeTibetan,
  tsvRow,
} from './normalize';
import type { DraftAlignment } from './read-draft';

/** Files by path; the order of insertion is the order the stored tree uses. */
export type SnapshotPart = Map<string, string>;

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

/** The annotation type the passage text needs: where an endnote attaches. */
export const NOTE_LINK_TYPE = 'end-note-link';

/** Where each part writes, relative to the work root. */
export const PART_PATHS = {
  passages: ['text', 'tibetan', 'notes.md', 'anchors.tsv'],
  rawPassages: ['raw/passages.jsonl'],
  annotations: ['annotations'],
  glossary: ['glossary.md', 'raw/glossary.jsonl'],
  bibliography: ['bibliography.md'],
} as const;

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

export const body = (lines: string[]): string =>
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

/** An anchor, or the uuid itself when the map lacks it. */
const anchorOf = (map: Map<string, string>, uuid: string) =>
  map.get(uuid) ?? uuid;

export const passageAnchors = (passages: readonly PublishedPassage[]) =>
  makeAnchors(
    passages.map((p) => p.uuid),
    'p',
  );
export const glossaryAnchors = (glossary: readonly PublishedGlossaryTerm[]) =>
  makeAnchors(
    glossary.map((g) => g.glossary_uuid),
    'g',
  );
export const bibliographyAnchors = (
  bibliographies: readonly PublishedBibliography[],
) =>
  makeAnchors(
    bibliographies.map((b) => b.uuid),
    'b',
  );

export interface Location {
  path: string;
  line: number;
}

/**
 * The text by section and chapter, endnotes, and the Tibetan mirror of aligned
 * passages: `text/`, `notes.md` (only when the work has endnotes) and `tibetan/`.
 * `noteLinks` may hold every annotation; only end-note links are used.
 */
export const renderPassageText = ({
  passages,
  noteLinks,
  alignments,
}: {
  passages: readonly PublishedPassage[];
  noteLinks: readonly PublishedAnnotation[];
  alignments: readonly DraftAlignment[];
}): { files: SnapshotPart; location: Map<string, Location> } => {
  const pAnchor = passageAnchors(passages);
  const passageByUuid = new Map(passages.map((p) => [p.uuid, p]));
  const linksByPassage = groupBy(
    noteLinks.filter((a) => a.type === NOTE_LINK_TYPE),
    (a) => a.passage_uuid,
  );
  const alignmentsByPassage = groupBy([...alignments], (a) => a.passage_uuid);
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

  const files = new Map<string, string[]>();
  const location = new Map<string, Location>();
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
    const notes = (linksByPassage.get(passage.uuid) ?? []).map((a) => ({
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

  const out: SnapshotPart = new Map();
  for (const [path, lines] of files) out.set(path, body(lines));
  return { files: out, location };
};

/** `raw/passages.jsonl`: each passage's stored content, in reading order. */
export const renderRawPassages = (
  passages: readonly PublishedPassage[],
): SnapshotPart => {
  const pAnchor = passageAnchors(passages);
  return new Map([
    [
      'raw/passages.jsonl',
      body(
        passages.map((p) =>
          JSON.stringify({
            uuid: p.uuid,
            anchor: anchorOf(pAnchor, p.uuid),
            content: p.content ?? '',
          }),
        ),
      ),
    ],
  ]);
};

/** `glossary.md`, one term per line, and `raw/glossary.jsonl`, as stored. */
export const renderGlossaryFiles = (
  glossary: readonly PublishedGlossaryTerm[],
): SnapshotPart => {
  const gAnchor = glossaryAnchors(glossary);
  return new Map([
    [
      'glossary.md',
      body(
        glossary.map((g) => termLine(anchorOf(gAnchor, g.glossary_uuid), g)),
      ),
    ],
    [
      'raw/glossary.jsonl',
      body(
        glossary.map((g) =>
          JSON.stringify({
            uuid: g.glossary_uuid,
            authority: g.authority_uuid,
            anchor: anchorOf(gAnchor, g.glossary_uuid),
            english: g.english,
            alternatives: g.alternatives,
          }),
        ),
      ),
    ],
  ]);
};

/** `bibliography.md`, one entry per line; headings add `## `. */
export const renderBibliographyFile = (
  bibliographies: readonly PublishedBibliography[],
): SnapshotPart => {
  const bAnchor = bibliographyAnchors(bibliographies);
  return new Map([
    [
      'bibliography.md',
      body(
        bibliographies.map((b) => {
          const text = b.is_heading
            ? `## ${htmlToText(b.heading ?? b.bibl_html)}`
            : htmlToText(b.bibl_html);
          return line(anchorOf(bAnchor, b.uuid), null, text);
        }),
      ),
    ],
  ]);
};

export interface AnnotationCounts {
  glossaryInstances: number;
  otherAnnotations: number;
  layoutAnnotations: number;
}

/**
 * `annotations/`: glossary instances with the text they cover, every other non-layout
 * annotation, and the layout annotations, in reading order.
 */
export const renderAnnotationFiles = ({
  passages,
  annotations,
  glossary,
  glossaryTermOf,
}: {
  passages: readonly PublishedPassage[];
  annotations: readonly PublishedAnnotation[];
  glossary: readonly PublishedGlossaryTerm[];
  /** Glossary uuid an instance may cite (term or child name) to its term uuid. */
  glossaryTermOf: ReadonlyMap<string, string>;
}): { files: SnapshotPart; counts: AnnotationCounts } => {
  const pAnchor = passageAnchors(passages);
  const gAnchor = glossaryAnchors(glossary);
  const annotationsByPassage = groupBy([...annotations], (a) => a.passage_uuid);
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
    for (const a of list) {
      const text = normalizeText((passage.content ?? '').slice(a.start, a.end));
      const anchor = anchorOf(pAnchor, passage.uuid);
      if (a.type === 'glossary-instance') {
        const cited = contentUuid(a.content) ?? '';
        const termUuid = glossaryTermOf.get(cited) ?? cited;
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
  return {
    files: new Map([
      ['annotations/glossary-instances.tsv', body(instances)],
      ['annotations/annotations.jsonl', body(other)],
      ['annotations/layout.jsonl', body(layout)],
    ]),
    counts: {
      glossaryInstances: instances.length - 1,
      otherAnnotations: other.length,
      layoutAnnotations: layout.length,
    },
  };
};

/**
 * `anchors.tsv`: every passage, glossary term and bibliography entry anchor with its
 * uuid, file and line. `passageLocation` comes from `renderPassageText`; terms and
 * entries sit one per line in `glossary.md` and `bibliography.md`.
 */
export const renderAnchors = ({
  passages,
  passageLocation,
  glossary,
  bibliographies,
}: {
  passages: readonly PublishedPassage[];
  passageLocation: ReadonlyMap<string, Location>;
  glossary: readonly PublishedGlossaryTerm[];
  bibliographies: readonly PublishedBibliography[];
}): { files: SnapshotPart; anchors: Map<string, string> } => {
  const location = new Map(passageLocation);
  glossary.forEach((g, i) =>
    location.set(g.glossary_uuid, { path: 'glossary.md', line: i + 1 }),
  );
  bibliographies.forEach((b, i) =>
    location.set(b.uuid, { path: 'bibliography.md', line: i + 1 }),
  );

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
  addAnchors('passage', passageAnchors(passages), [...passages]);
  addAnchors(
    'glossary',
    glossaryAnchors(glossary),
    glossary.map((g) => ({
      uuid: g.glossary_uuid,
      label: g.term_number,
      type: 'term',
      sort: g.term_number,
    })),
  );
  addAnchors(
    'bibliography',
    bibliographyAnchors(bibliographies),
    bibliographies.map((b) => ({
      uuid: b.uuid,
      label: null,
      type: b.is_heading ? 'heading' : 'entry',
      sort: b.sort,
    })),
  );
  return { files: new Map([['anchors.tsv', body(anchorRows)]]), anchors };
};

/**
 * The passages part: text, Tibetan mirror, notes (always present, empty when the work
 * has none) and `anchors.tsv`, which also lists glossary and bibliography anchors.
 */
export const renderPassagesPart = ({
  passages,
  noteLinks,
  alignments,
  glossary,
  bibliographies,
}: {
  passages: readonly PublishedPassage[];
  noteLinks: readonly PublishedAnnotation[];
  alignments: readonly DraftAlignment[];
  glossary: readonly PublishedGlossaryTerm[];
  bibliographies: readonly PublishedBibliography[];
}): SnapshotPart => {
  const text = renderPassageText({ passages, noteLinks, alignments });
  const { files: anchors } = renderAnchors({
    passages,
    passageLocation: text.location,
    glossary,
    bibliographies,
  });
  const files = new Map([...text.files, ...anchors]);
  if (!files.has('notes.md')) files.set('notes.md', '');
  return files;
};
