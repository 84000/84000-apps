import { RE2JS } from 're2js';
import { z } from 'zod';
import type { McpToolDefinition } from '../../types';
import { errorResult, textResult } from '../read/util';
import { fileLineStarts, openSnapshotFiles } from './open';
import type { WorkSnapshotFiles, WorkSnapshotSource } from './source';
import {
  OUTPUT_TOKEN_BUDGET,
  estimateTokens,
  foldDiacritics,
  foldLine,
  formatCount,
  freshnessLine,
  lineAt,
  lineStarts,
  normalizeSnapshotPath,
} from './text';

export const GREP_OUTPUT_MODES = [
  'content',
  'files',
  'count',
  'tally',
] as const;
export type GrepOutputMode = (typeof GREP_OUTPUT_MODES)[number];

export const MAX_GREP_CONTEXT = 10;
export const DEFAULT_GREP_HEAD_LIMIT = 100;
export const MAX_GREP_HEAD_LIMIT = 1000;
export const MAX_GREP_PATTERN_LENGTH = 1000;
export const MAX_GREP_GLOB_LENGTH = 200;
/** Tally values longer than this are cut. */
export const MAX_TALLY_VALUE_CHARS = 200;
/** Matching lines longer than this show a window around the first match. */
export const MAX_GREP_LINE_CHARS = 500;

const inputSchema = {
  work: z.string().describe('Toh key ("toh8") or work uuid'),
  pattern: z
    .string()
    .min(1)
    .max(MAX_GREP_PATTERN_LENGTH)
    .describe(
      'RE2 regular expression, matched line by line (no backreferences or lookaround)',
    ),
  path: z
    .string()
    .optional()
    .describe('File or directory to search, relative to the snapshot root'),
  glob: z
    .string()
    .max(MAX_GREP_GLOB_LENGTH)
    .optional()
    .describe('Only paths matching this glob, e.g. "*.md" or "text/**/*.md"'),
  context: z
    .number()
    .int()
    .min(0)
    .max(MAX_GREP_CONTEXT)
    .optional()
    .describe('Lines of context around each match (content mode)'),
  output_mode: z
    .enum(GREP_OUTPUT_MODES)
    .optional()
    .describe(
      '"content" (default): matching lines; "files": paths with a match; "count": matching lines per file; "tally": each distinct match (the first capture group, if any) with its count',
    ),
  case_insensitive: z.boolean().optional().describe('Ignore case'),
  fold_diacritics: z
    .boolean()
    .optional()
    .describe(
      'Match "Manjusri" to "Mañjuśrī" by ignoring Latin diacritics in text and pattern, character classes included (default true)',
    ),
  head_limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_GREP_HEAD_LIMIT)
    .optional()
    .describe(
      `Most lines, files or tally rows to show (default ${DEFAULT_GREP_HEAD_LIMIT})`,
    ),
};

export interface GrepOptions {
  pattern: string;
  path?: string;
  glob?: string;
  context?: number;
  mode?: GrepOutputMode;
  caseInsensitive?: boolean;
  foldDiacritics?: boolean;
  headLimit?: number;
}

/**
 * A glob as an RE2 pattern over snapshot paths: `*` and `?` stay within one path
 * segment, `**` crosses segments, `{a,b}` is a choice. A glob without `/`
 * matches the file name at any depth, as ripgrep does.
 */
export const compileGlob = (glob: string): RE2JS => {
  let source = '';
  let braces = 0;
  for (let i = 0; i < glob.length; i++) {
    const char = glob[i];
    if (char === '*') {
      if (glob[i + 1] === '*') {
        i++;
        if (glob[i + 1] === '/') {
          i++;
          source += '(?:.*/)?';
        } else {
          source += '.*';
        }
      } else {
        source += '[^/]*';
      }
    } else if (char === '?') source += '[^/]';
    else if (char === '{') {
      braces++;
      source += '(?:';
    } else if (char === '}' && braces > 0) {
      braces--;
      source += ')';
    } else if (char === ',' && braces > 0) source += '|';
    else source += RE2JS.quote(char);
  }
  source += ')'.repeat(braces);
  return RE2JS.compile(
    glob.includes('/') ? `^${source}$` : `(?:^|/)${source}$`,
  );
};

/** The files under `path` whose paths match `glob`, in path order. */
const selectFiles = (
  files: WorkSnapshotFiles,
  path: string,
  glob: RE2JS | null,
): string[] =>
  [...files.keys()]
    .filter(
      (key) =>
        (!path || key === path || key.startsWith(`${path}/`)) &&
        (!glob || glob.test(key)),
    )
    .sort();

const same = (offset: number) => offset;

const clipValue = (value: string): string =>
  value.length > MAX_TALLY_VALUE_CHARS
    ? `${value.slice(0, MAX_TALLY_VALUE_CHARS)}…`
    : value;

const clip = (line: string, at: number): string => {
  if (line.length <= MAX_GREP_LINE_CHARS) return line;
  const start = Math.max(
    0,
    Math.min(at - 100, line.length - MAX_GREP_LINE_CHARS),
  );
  const end = start + MAX_GREP_LINE_CHARS;
  return `${start > 0 ? '…' : ''}${line.slice(start, end)}${end < line.length ? '…' : ''}`;
};

/** Collects output lines until the head limit or the token budget runs out. */
class Output {
  readonly lines: string[] = [];
  private tokens = 0;
  full = false;

  constructor(private readonly limit: number) {}

  push(line: string): boolean {
    const cost = estimateTokens(line) + 1;
    if (
      this.lines.length >= this.limit ||
      (this.lines.length > 0 && this.tokens + cost > OUTPUT_TOKEN_BUDGET)
    ) {
      this.full = true;
      return false;
    }
    this.lines.push(line);
    this.tokens += cost;
    return true;
  }
}

/**
 * Search a snapshot's files with an RE2 pattern, line by line, in the manner of
 * ripgrep. RE2 runs in time linear in the input, so no pattern can backtrack
 * catastrophically. Returns the output, or an error message for a bad pattern
 * or path.
 */
export const grepSnapshot = (
  files: WorkSnapshotFiles,
  root: string,
  options: GrepOptions,
): { ok: true; text: string } | { ok: false; error: string } => {
  const mode = options.mode ?? 'content';
  const fold = options.foldDiacritics ?? true;
  const context = Math.min(options.context ?? 0, MAX_GREP_CONTEXT);
  const headLimit = Math.min(
    options.headLimit ?? DEFAULT_GREP_HEAD_LIMIT,
    MAX_GREP_HEAD_LIMIT,
  );

  const pattern = fold ? foldDiacritics(options.pattern) : options.pattern;
  const flags = options.caseInsensitive ? RE2JS.CASE_INSENSITIVE : 0;
  let re: RE2JS;
  // Rules out files with one pass over the whole text. Multi-line, so `^` and
  // `$` still find matches on any line; skipped when the pattern sets its own
  // flags or anchors to the text's ends.
  let prefilter: RE2JS | null;
  try {
    re = RE2JS.compile(pattern, flags);
    prefilter = /\\[Az]|\(\?/.test(pattern)
      ? null
      : RE2JS.compile(pattern, flags | RE2JS.MULTILINE);
  } catch (error) {
    return {
      ok: false,
      error: `Invalid pattern: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
  const path = normalizeSnapshotPath(options.path, root);
  if (path === null)
    return { ok: false, error: `Invalid path: ${options.path}` };
  let glob: RE2JS | null = null;
  try {
    glob = options.glob ? compileGlob(options.glob) : null;
  } catch {
    return { ok: false, error: `Invalid glob: ${options.glob}` };
  }
  const selected = selectFiles(files, path, glob);
  if (selected.length === 0) {
    return {
      ok: false,
      error: `No files under "${path || '/'}"${options.glob ? ` match "${options.glob}"` : ''}.`,
    };
  }

  const out = new Output(headLimit);
  const tally = new Map<string, number>();
  let matchedLines = 0;
  let matchedFiles = 0;

  for (const file of selected) {
    const text = files.get(file) ?? '';
    const haystack = fold ? foldDiacritics(text) : text;
    if (prefilter && !prefilter.test(haystack)) continue;
    const starts = fileLineStarts(files, file, text);
    const searchStarts = haystack === text ? starts : lineStarts(haystack);

    const hits: number[] = [];
    for (let i = 0; i < searchStarts.length; i++) {
      if (re.test(lineAt(haystack, searchStarts, i))) hits.push(i);
    }
    if (hits.length === 0) continue;
    matchedFiles++;
    matchedLines += hits.length;
    if (out.full && mode !== 'tally') continue;

    const original = (i: number) => lineAt(text, starts, i);
    // A hit line refolded with offsets back into the original.
    const folded = (i: number) =>
      haystack === text
        ? { text: original(i), start: same, end: same }
        : foldLine(original(i));
    const firstMatch = (i: number) => {
      const line = folded(i);
      const matcher = re.matcher(line.text);
      return matcher.find() ? line.start(matcher.start()) : 0;
    };

    if (mode === 'files') {
      out.push(file);
    } else if (mode === 'count') {
      out.push(`${file}:${hits.length}`);
    } else if (mode === 'tally') {
      const group = re.groupCount() > 0 ? 1 : 0;
      for (const i of hits) {
        const source = original(i);
        const line = folded(i);
        const matcher = re.matcher(line.text);
        while (matcher.find()) {
          const start = matcher.start(group);
          const end = matcher.end(group);
          if (start < 0 || end <= start) continue;
          const value = source.slice(line.start(start), line.end(end));
          tally.set(value, (tally.get(value) ?? 0) + 1);
        }
      }
    } else {
      const hitSet = new Set(hits);
      let shown = -1;
      for (const i of hits) {
        const from = Math.max(i - context, shown + 1);
        if (context > 0 && shown >= 0 && from > shown + 1 && !out.push('--'))
          break;
        const to = Math.min(i + context, starts.length - 1);
        let stopped = false;
        for (let n = from; n <= to; n++) {
          const isHit = hitSet.has(n);
          const line = isHit
            ? clip(original(n), firstMatch(n))
            : clip(original(n), 0);
          if (
            !out.push(
              `${file}${isHit ? ':' : '-'}${n + 1}${isHit ? ':' : '-'}${line}`,
            )
          ) {
            stopped = true;
            break;
          }
          shown = n;
        }
        if (stopped) break;
      }
      if (context > 0 && !out.full) out.push('--');
    }
  }

  const summary = `${formatCount(matchedLines)} matching line${matchedLines === 1 ? '' : 's'} in ${formatCount(matchedFiles)} file${matchedFiles === 1 ? '' : 's'}`;
  if (mode === 'tally') {
    const rows = [...tally.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    );
    for (const [value, count] of rows) {
      if (!out.push(`${count}\t${clipValue(value)}`)) break;
    }
    const total = rows.reduce((sum, [, count]) => sum + count, 0);
    const shown = out.lines.length;
    const note =
      shown < rows.length
        ? `; showing the top ${formatCount(shown)}. Raise head_limit or narrow the pattern.`
        : '.';
    out.lines.push(
      `[${formatCount(rows.length)} distinct, ${formatCount(total)} matches; ${summary}${note}]`,
    );
  } else if (matchedLines === 0) {
    out.lines.push('[No matches.]');
  } else {
    if (out.lines[out.lines.length - 1] === '--') out.lines.pop();
    out.lines.push(
      out.full
        ? `[${summary}; output stopped at the head_limit or the token cap. Narrow with path or glob, or use output_mode "count" or "files".]`
        : `[${summary}.]`,
    );
  }
  return { ok: true, text: out.lines.join('\n') };
};

/** `work-grep`: search a work's draft snapshot with a safe regular expression. */
export function createWorkGrepTool(
  source: WorkSnapshotSource,
): McpToolDefinition {
  return {
    name: 'work-grep',
    description: `Search a work's whole draft snapshot with an RE2 regular expression, line by line, with ripgrep-style output ("path:line:text"). Modes: content (default), files, count, and tally (distinct matches with counts; tallies the first capture group when the pattern has one). Latin diacritics are ignored by default. Use it for every occurrence of a term, name or phrase across the work; read around a hit with \`work-read\`. Requires editor.read.`,
    inputSchema,
    annotations: {
      title: 'Search Work Snapshot',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async (args) => {
      const opened = await openSnapshotFiles(source, args.work);
      if (!opened.ok) return opened.result;
      const { snapshot, files } = opened.value;
      const result = grepSnapshot(files, snapshot.root, {
        pattern: args.pattern,
        path: args.path,
        glob: args.glob,
        context: args.context,
        mode: args.output_mode,
        caseInsensitive: args.case_insensitive,
        foldDiacritics: args.fold_diacritics,
        headLimit: args.head_limit,
      });
      if (!result.ok) return errorResult(result.error);
      return textResult(`${freshnessLine(snapshot)}\n${result.text}`);
    },
  };
}
