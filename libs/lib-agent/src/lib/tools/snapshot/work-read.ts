import { z } from 'zod';
import type { McpToolDefinition } from '../../types';
import { errorResult, textResult } from '../read/util';
import { fileLineStarts, openSnapshotFiles } from './open';
import type { WorkSnapshotSource } from './source';
import {
  OUTPUT_TOKEN_BUDGET,
  estimateTokens,
  formatCount,
  freshnessLine,
  lineAt,
  normalizeSnapshotPath,
} from './text';

/** Most lines one call returns. */
export const MAX_READ_LINES = 2000;
/** Longer lines are cut to this many characters. */
export const MAX_LINE_CHARS = 2000;

const inputSchema = {
  work: z.string().describe('Toh key ("toh8") or work uuid'),
  path: z.string().describe('File path, relative to the snapshot root'),
  offset: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe('First line to read, 1-based (default 1)'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_READ_LINES)
    .optional()
    .describe(`Lines to read (default and maximum ${MAX_READ_LINES})`),
};

/**
 * Lines `offset..offset+limit-1` of `text`, numbered, with long lines cut and the
 * output kept within the token budget. Ends with a note naming the offset to
 * continue from when lines remain.
 */
export const readLines = ({
  text,
  starts,
  offset,
  limit,
}: {
  text: string;
  starts: number[];
  offset: number;
  limit: number;
}): string => {
  const total = starts.length;
  const width = String(Math.min(total, offset + limit - 1)).length;
  const out: string[] = [];
  let tokens = 0;
  let last = offset - 1;
  for (let n = offset; n <= Math.min(total, offset + limit - 1); n++) {
    let line = lineAt(text, starts, n - 1);
    if (line.length > MAX_LINE_CHARS) {
      line = `${line.slice(0, MAX_LINE_CHARS)} … [${formatCount(line.length - MAX_LINE_CHARS)} more chars]`;
    }
    const numbered = `${String(n).padStart(width)}\t${line}`;
    const cost = estimateTokens(numbered) + 1;
    if (out.length > 0 && tokens + cost > OUTPUT_TOKEN_BUDGET) break;
    out.push(numbered);
    tokens += cost;
    last = n;
  }
  if (last < total) {
    out.push(
      `[Lines ${offset}–${last} of ${formatCount(total)}. Continue at offset ${last + 1}.]`,
    );
  }
  return out.join('\n');
};

/** `work-read`: numbered lines from one file of a work's draft snapshot. */
export function createWorkReadTool(
  source: WorkSnapshotSource,
): McpToolDefinition {
  return {
    name: 'work-read',
    description: `Read a file of a work's draft snapshot as numbered lines, ${MAX_READ_LINES} at most per call, long lines cut at ${MAX_LINE_CHARS} characters, and output capped near ${formatCount(OUTPUT_TOKEN_BUDGET)} tokens with the offset to continue from. Find files with \`work-ls\` and lines with \`work-grep\`. Requires editor.read.`,
    inputSchema,
    annotations: {
      title: 'Read Work Snapshot File',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ work, path, offset = 1, limit = MAX_READ_LINES }) => {
      const opened = await openSnapshotFiles(source, work);
      if (!opened.ok) return opened.result;
      const { snapshot, files } = opened.value;
      const file = normalizeSnapshotPath(path, snapshot.root);
      if (file === null) return errorResult(`Invalid path: ${path}`);
      if (!file) {
        return errorResult(
          'That path is the snapshot root; list it with `work-ls`.',
        );
      }
      const text = files.get(file);
      if (text === undefined) {
        const isDir = [...files.keys()].some((key) =>
          key.startsWith(`${file}/`),
        );
        return errorResult(
          isDir
            ? `"${file}" is a directory; list it with \`work-ls\`.`
            : `No file "${file}" in the ${snapshot.root} snapshot.`,
        );
      }
      const starts = fileLineStarts(files, file, text);
      const header = `${freshnessLine(snapshot)}\n${snapshot.root}/${file}`;
      if (starts.length === 0) return textResult(`${header}\n[Empty file.]`);
      if (offset > starts.length) {
        return errorResult(
          `${file} has ${formatCount(starts.length)} lines; offset ${offset} is past the end.`,
        );
      }
      return textResult(
        `${header}\n${readLines({ text, starts, offset, limit })}`,
      );
    },
  };
}
