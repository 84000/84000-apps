import { z } from 'zod';
import type { McpToolDefinition } from '../../types';
import { errorResult, textResult } from '../read/util';
import { openSnapshot } from './open';
import type {
  ReadyWorkSnapshot,
  WorkSnapshotFile,
  WorkSnapshotSource,
} from './source';
import { formatCount, freshnessLine, normalizeSnapshotPath } from './text';

const inputSchema = {
  work: z.string().describe('Toh key ("toh8") or work uuid'),
  path: z
    .string()
    .optional()
    .describe(
      'Directory to list, relative to the snapshot root. Omit for the root.',
    ),
};

interface Row {
  name: string;
  files: number;
  bytes: number;
  lines: number;
  dir: boolean;
}

/**
 * One directory level of a snapshot, from its manifest: files with their bytes
 * and lines, and subdirectories with their totals. Null for a missing directory.
 */
export const listSnapshotDirectory = (
  snapshot: ReadyWorkSnapshot,
  dir: string,
): Row[] | null => {
  const files: WorkSnapshotFile[] = [
    ...(snapshot.manifest.files ?? []),
    // The manifest lists every file but itself.
    { path: 'manifest.json', bytes: Number.NaN, lines: Number.NaN },
  ];
  const prefix = dir ? `${dir}/` : '';
  const rows = new Map<string, Row>();
  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    const rest = file.path.slice(prefix.length);
    const slash = rest.indexOf('/');
    const name = slash === -1 ? rest : rest.slice(0, slash);
    const row = rows.get(name) ?? {
      name,
      files: 0,
      bytes: 0,
      lines: 0,
      dir: slash !== -1,
    };
    row.files++;
    row.bytes += file.bytes;
    row.lines += file.lines;
    rows.set(name, row);
  }
  if (rows.size === 0) return null;
  return [...rows.values()].sort(
    (a, b) => Number(b.dir) - Number(a.dir) || a.name.localeCompare(b.name),
  );
};

const formatRows = (rows: Row[]): string => {
  const size = (value: number) =>
    Number.isNaN(value) ? '-' : formatCount(value);
  const table = rows.map((row) => [
    row.dir ? `${row.name}/` : row.name,
    row.dir ? `${row.files} file${row.files === 1 ? '' : 's'}` : '',
    `${size(row.bytes)} bytes`,
    `${size(row.lines)} lines`,
  ]);
  const widths = [0, 1, 2, 3].map((col) =>
    Math.max(...table.map((cells) => cells[col].length)),
  );
  return table
    .map((cells) =>
      cells
        .map((cell, col) =>
          col === 0 ? cell.padEnd(widths[col]) : cell.padStart(widths[col]),
        )
        .join('  ')
        .trimEnd(),
    )
    .join('\n');
};

/** `work-ls`: one directory level of a work's draft snapshot. */
export function createWorkLsTool(
  source: WorkSnapshotSource,
): McpToolDefinition {
  return {
    name: 'work-ls',
    description:
      "List one directory of a work's draft snapshot: the whole work as files (text by section, Tibetan, notes, glossary, bibliography, annotations), with bytes and lines. Start at the root, whose README.md explains the layout. Requires editor.read.",
    inputSchema,
    annotations: {
      title: 'List Work Snapshot',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async ({ work, path }) => {
      const opened = await openSnapshot(source, work);
      if (!opened.ok) return opened.result;
      const snapshot = opened.value;
      const dir = normalizeSnapshotPath(path, snapshot.root);
      if (dir === null) return errorResult(`Invalid path: ${path}`);
      const rows = listSnapshotDirectory(snapshot, dir);
      if (!rows && snapshot.manifest.files?.some((file) => file.path === dir)) {
        return errorResult(`"${dir}" is a file; read it with \`work-read\`.`);
      }
      if (!rows) {
        return errorResult(
          `No directory "${dir}" in the ${snapshot.root} snapshot. List the root to see what exists.`,
        );
      }
      const heading = `${snapshot.root}/${dir ? `${dir}/` : ''}`;
      return textResult(
        `${freshnessLine(snapshot)}\n${heading}\n${formatRows(rows)}`,
      );
    },
  };
}
