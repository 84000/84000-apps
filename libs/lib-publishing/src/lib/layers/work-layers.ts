/**
 * The parts of a work's snapshot as layers: `work.passages`, `work.passages.raw`,
 * `work.annotations`, `work.glossary` and `work.bibliography`. Each writes the files the
 * stored work snapshot holds for its part, under the work's root, and reads its draft
 * or its live published version.
 *
 * Together they hold the stored snapshot's files, rendered by the same functions, so
 * the `work` preset matches the snapshot `work-ls`, `work-read` and `work-grep` read.
 */

import type { DataClient } from '@eightyfourthousand/data-access';
import { z } from 'zod';
import { MIN_ANCHOR_HEX } from '../snapshot/anchors';
import {
  NOTE_LINK_TYPE,
  PART_PATHS,
  renderAnnotationFiles,
  renderBibliographyFile,
  renderGlossaryFiles,
  renderPassagesPart,
  renderRawPassages,
} from '../snapshot/parts';
import { readAlignments } from '../snapshot/read-draft';
import {
  readSourceAnnotations,
  readSourceBibliographies,
  readSourceGlossary,
  readSourcePassages,
  resolveSourceWork,
  type ResolveSourceWorkResult,
  type SourceWork,
} from '../snapshot/read-source';
import { SNAPSHOT_FORMAT_VERSION } from '../snapshot/render';
import type { SnapshotManifest } from '../snapshot/render';
import { sourceOption, workOption } from './registry';
import type {
  LayerContext,
  LayerFiles,
  LayerResolution,
  LayerSource,
  SnapshotLayer,
} from './types';

const options = z.strictObject({
  work: workOption(),
  source: sourceOption('published'),
});

type WorkLayerOptions = z.output<typeof options>;

/** The rows a part renders, read once per request whichever layers ask. */
export interface WorkRows {
  passages(): Promise<Awaited<ReturnType<typeof readSourcePassages>>>;
  /** Only the end-note links the passage text needs. */
  noteLinks(): Promise<Awaited<ReturnType<typeof readSourceAnnotations>>>;
  annotations(): Promise<Awaited<ReturnType<typeof readSourceAnnotations>>>;
  glossary(): Promise<Awaited<ReturnType<typeof readSourceGlossary>>>;
  bibliographies(): Promise<
    Awaited<ReturnType<typeof readSourceBibliographies>>
  >;
  alignments(): Promise<Awaited<ReturnType<typeof readAlignments>>>;
}

/** Where a work layer's data comes from; injectable for specs. */
export interface WorkLayerSource {
  resolve(
    context: LayerContext,
    work: string,
    source: LayerSource,
  ): Promise<ResolveSourceWorkResult>;
  rows(context: LayerContext, work: SourceWork): WorkRows;
  /** The stored draft snapshot's manifest and size, to estimate downloads. */
  storedSnapshot(
    context: LayerContext,
    workUuid: string,
  ): Promise<{ manifest: SnapshotManifest; archiveBytes: number } | null>;
}

const readStoredSnapshot = async (client: DataClient, workUuid: string) => {
  const { data, error } = await client
    .from('work_snapshots')
    .select('manifest, archive_bytes')
    .eq('work_uuid', workUuid)
    .maybeSingle();
  if (error || !data?.manifest || !data.archive_bytes) return null;
  return {
    manifest: data.manifest as SnapshotManifest,
    archiveBytes: Number(data.archive_bytes),
  };
};

/** Reads through the request's service_role client. */
export const databaseWorkSource: WorkLayerSource = {
  resolve: (ctx, work, source) =>
    ctx.memo(`work:${source}:${work}`, () =>
      resolveSourceWork({ client: ctx.client, work, source }),
    ),
  rows: (ctx, work) => {
    const { client } = ctx;
    // The other reads need the passage uuids; the layers share every read.
    const passages = () =>
      ctx.memo(
        `work-passages:${work.source}:${work.uuid}:${work.versionUuid ?? ''}`,
        () => readSourcePassages(client, work),
      );
    const uuids = async () => (await passages()).map((p) => p.uuid);
    return {
      passages,
      noteLinks: async () =>
        readSourceAnnotations(client, work, await uuids(), [NOTE_LINK_TYPE]),
      annotations: async () =>
        readSourceAnnotations(client, work, await uuids()),
      glossary: () => readSourceGlossary(client, work),
      bibliographies: () => readSourceBibliographies(client, work),
      alignments: async () =>
        readAlignments(client, await uuids(), work.tohs[0]),
    };
  },
  storedSnapshot: (ctx, workUuid) =>
    ctx.memo(`stored-snapshot:${workUuid}`, () =>
      readStoredSnapshot(ctx.client, workUuid).catch(() => null),
    ),
};

/** `rows`, with each read made once per request across every work layer. */
const sharedRows = (
  ctx: LayerContext,
  work: SourceWork,
  rows: WorkRows,
): WorkRows => {
  const key = (part: string) =>
    `work-rows:${work.source}:${work.uuid}:${work.versionUuid ?? ''}:${part}`;
  return {
    passages: () => ctx.memo(key('passages'), rows.passages),
    noteLinks: () => ctx.memo(key('note-links'), rows.noteLinks),
    annotations: () => ctx.memo(key('annotations'), rows.annotations),
    glossary: () => ctx.memo(key('glossary'), rows.glossary),
    bibliographies: () => ctx.memo(key('bibliographies'), rows.bibliographies),
    alignments: () => ctx.memo(key('alignments'), rows.alignments),
  };
};

/** Used when no stored snapshot gives a better estimate. */
const FALLBACK_ESTIMATE_BYTES = 1024 * 1024;

const DAY_MS = 24 * 60 * 60 * 1000;

interface WorkPart {
  name: string;
  description: string;
  typicalSize: string;
  claims: readonly string[];
  /**
   * The part reads alignments, which no draft or publish key tracks, so its data
   * version also turns over daily, as the stored snapshot refreshes.
   */
  readsAlignments?: boolean;
  generate(rows: WorkRows): Promise<LayerFiles>;
  readme(dir: string, source: LayerSource): string;
}

const sourceLine = (source: LayerSource) =>
  source === 'draft'
    ? 'From the DRAFT, as editors see it now: read-only; the studio write tools take uuids.'
    : 'From the live PUBLISHED version.';

const anchorsLine = `Anchors are the first ${MIN_ANCHOR_HEX} hex digits of the uuid, longer only where two would collide; \`anchors.tsv\` (from \`work.passages\`) maps each to its uuid, file and line.`;

const PARTS: WorkPart[] = [
  {
    name: 'work.passages',
    description:
      "A work's text as files: one passage per line by section and chapter (`text/`), endnotes (`notes.md`), the aligned Tibetan beside each section (`tibetan/`), and `anchors.tsv`, which maps every passage, glossary and bibliography anchor to its uuid, file and line.",
    typicalSize: '20 KB to 6 MB',
    claims: PART_PATHS.passages,
    readsAlignments: true,
    generate: async (rows) => {
      const [passages, noteLinks, alignments, glossary, bibliographies] =
        await Promise.all([
          rows.passages(),
          rows.noteLinks(),
          rows.alignments(),
          rows.glossary(),
          rows.bibliographies(),
        ]);
      return renderPassagesPart({
        passages,
        noteLinks,
        alignments,
        glossary: glossary.terms,
        bibliographies,
      });
    },
    readme: (dir, source) =>
      [
        sourceLine(source),
        '',
        `- \`${dir}/text/\`: one passage per line, starting \`[p-<id> <label>]\`; headings add \`## \`. The translation is split by chapter when it has chapters.`,
        `- \`${dir}/notes.md\`: the endnotes. \`[^n.12]\` in the text marks where endnote n.12 attaches; where two notes share a label, the marker adds the note anchor: \`[^n.12 p-<id>]\`.`,
        `- \`${dir}/tibetan/\`: mirrors \`text/\` for aligned passages, with folios and the same anchors.`,
        `- \`${dir}/anchors.tsv\`: every anchor with its uuid, kind, label, type, sort, file and line. Glossary and bibliography rows point into \`glossary.md\` and \`bibliography.md\`, which come with \`work.glossary\` and \`work.bibliography\`.`,
        `- Anchors are the first ${MIN_ANCHOR_HEX} hex digits of the uuid, longer only where two would collide.`,
        '- Soft hyphens are removed; line breaks become spaces (Tibetan folio line breaks are dropped).',
      ].join('\n'),
  },
  {
    name: 'work.passages.raw',
    description:
      "A work's passages exactly as stored, one JSON object per line in reading order (`raw/passages.jsonl`: uuid, anchor, content). Annotation offsets and the write tools index this text.",
    typicalSize: '20 KB to 6 MB',
    claims: PART_PATHS.rawPassages,
    generate: async (rows) => renderRawPassages(await rows.passages()),
    readme: (dir, source) =>
      [
        sourceLine(source),
        '',
        `- \`${dir}/raw/passages.jsonl\`: one passage per line, \`{"uuid", "anchor", "content"}\`, in reading order, with \`content\` exactly as stored (soft hyphens and line breaks kept). Annotation \`start\`/\`end\` offsets index this text. For scripts.`,
      ].join('\n'),
  },
  {
    name: 'work.annotations',
    description:
      "A work's annotations by passage, in reading order: glossary instances with the text they cover (TSV), every other non-layout annotation, and layout annotations (JSONL).",
    typicalSize: '10 KB to 60 MB',
    claims: PART_PATHS.annotations,
    generate: async (rows) => {
      const [passages, annotations, glossary] = await Promise.all([
        rows.passages(),
        rows.annotations(),
        rows.glossary(),
      ]);
      return renderAnnotationFiles({
        passages,
        annotations,
        glossary: glossary.terms,
        glossaryTermOf: glossary.termOf,
      }).files;
    },
    readme: (dir, source) =>
      [
        source === 'draft'
          ? `${sourceLine(source)} Draft annotations include \`comment\` and legacy \`deprecated-*\` types.`
          : sourceLine(source),
        '',
        `- \`${dir}/annotations/glossary-instances.tsv\`: every glossary instance: term anchor, term, passage anchor, label, start, end, the text it covers, and its uuid.`,
        `- \`${dir}/annotations/annotations.jsonl\`: every other non-layout annotation, one JSON object per line.`,
        `- \`${dir}/annotations/layout.jsonl\`: lines, paragraphs, headings and other layout.`,
        `- \`start\`/\`end\` are offsets into the stored passage text (\`work.passages.raw\`), which may still contain soft hyphens; \`text\` is the normalized span. ${anchorsLine}`,
      ].join('\n'),
  },
  {
    name: 'work.glossary',
    description:
      "A work's glossary: one term per line with English, alternatives, Tibetan, Wylie, Sanskrit and definition (`glossary.md`), and the stored names as JSON (`raw/glossary.jsonl`).",
    typicalSize: '5 KB to 1 MB',
    claims: PART_PATHS.glossary,
    generate: async (rows) =>
      renderGlossaryFiles((await rows.glossary()).terms),
    readme: (dir, source) =>
      [
        sourceLine(source),
        '',
        `- \`${dir}/glossary.md\`: one term per line, \`[g-<id> #<n>] en: … | alt: … | bo: … | wylie: … | sa: … | def: …\`.`,
        `- \`${dir}/raw/glossary.jsonl\`: one term per line, \`{"uuid", "authority", "anchor", "english", "alternatives"}\`, as stored.`,
        `- Anchors are the first ${MIN_ANCHOR_HEX} hex digits of the uuid, longer only where two would collide; \`raw/glossary.jsonl\` maps each to its uuid.`,
      ].join('\n'),
  },
  {
    name: 'work.bibliography',
    description:
      "A work's bibliography, one entry per line with headings (`bibliography.md`).",
    typicalSize: '1 KB to 200 KB',
    claims: PART_PATHS.bibliography,
    generate: async (rows) =>
      renderBibliographyFile(await rows.bibliographies()),
    readme: (dir, source) =>
      [
        sourceLine(source),
        '',
        `- \`${dir}/bibliography.md\`: one entry per line, \`[b-<id>]\`; headings add \`## \`. ${anchorsLine}`,
      ].join('\n'),
  },
];

/**
 * The stored snapshot's compressed bytes for the files under `claims`, or a fixed
 * guess when no stored snapshot in the current format exists.
 */
const estimate = (
  stored: { manifest: SnapshotManifest; archiveBytes: number } | null,
  claims: readonly string[],
): number => {
  const total = stored?.manifest.totals?.bytes ?? 0;
  if (
    !stored ||
    !total ||
    (stored.manifest.formatVersion ?? 0) < SNAPSHOT_FORMAT_VERSION
  ) {
    return FALLBACK_ESTIMATE_BYTES;
  }
  const bytes = stored.manifest.files
    .filter(({ path }) =>
      claims.some((c) => path === c || path.startsWith(`${c}/`)),
    )
    .reduce((sum, f) => sum + f.bytes, 0);
  return Math.max(1, Math.round((bytes * stored.archiveBytes) / total));
};

const workLayer = (
  part: WorkPart,
  data: WorkLayerSource,
): SnapshotLayer<typeof options> => ({
  name: part.name,
  description: `${part.description} \`source\`: \`published\` (default, the live published version) or \`draft\` (needs editor.read).`,
  permission: 'editor.read',
  permissionFor: ({ source }: WorkLayerOptions) =>
    source === 'draft' ? 'editor.read' : null,
  scope: 'work',
  options,
  sources: ['draft', 'published'],
  typicalSize: part.typicalSize,
  prebuilt: false,
  resolve: async (ctx, { work, source }): Promise<LayerResolution> => {
    let resolved: ResolveSourceWorkResult;
    try {
      resolved = await data.resolve(ctx, work, source);
    } catch (error) {
      console.error(`Resolving ${work} (${source}) failed:`, error);
      return {
        status: 'error',
        error: `${work} could not be read. Try again shortly.`,
      };
    }
    if (resolved.status === 'not-found') {
      return {
        status: 'not-found',
        error: `No work matches "${work}". Pass a Toh key such as "toh8" or a work uuid.`,
      };
    }
    if (resolved.status === 'unpublished') {
      return {
        status: 'not-found',
        error: `${work} has no published version yet; request ${part.name} with source "draft".`,
      };
    }
    const target = resolved.work;
    const dir = target.tohs[0] ?? target.uuid;
    const version =
      target.source === 'draft'
        ? `draft:${target.draftTouchedAt ?? 'never'}`
        : `published:${target.versionUuid}`;
    // Alignments, and a draft with no recorded edit, have no key that tracks them.
    const untracked =
      part.readsAlignments ||
      (target.source === 'draft' && !target.draftTouchedAt);
    const day = untracked ? `:day:${Math.floor(ctx.now() / DAY_MS)}` : '';
    const stored = await data.storedSnapshot(ctx, target.uuid);
    return {
      status: 'ready',
      kind: 'generated',
      dir,
      claims: part.claims,
      dataVersion: `v${SNAPSHOT_FORMAT_VERSION}:${target.uuid}:${version}${day}`,
      estimatedBytes: estimate(stored, part.claims),
      generate: () =>
        part.generate(sharedRows(ctx, target, data.rows(ctx, target))),
    };
  },
  readme: ({ source }, { dir }) => part.readme(dir, source),
});

/** The work layers, reading through `data`. */
export const createWorkLayers = (
  data: WorkLayerSource = databaseWorkSource,
): SnapshotLayer<typeof options>[] =>
  PARTS.map((part) => workLayer(part, data));

/** Their names, in the order the `work` preset lists them. */
export const WORK_LAYER_NAMES = PARTS.map((p) => p.name);
