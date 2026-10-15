import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { errorResult, textResult } from '../read/util';
import type {
  ReadyWorkSnapshot,
  WorkSnapshotFiles,
  WorkSnapshotSource,
  WorkSnapshotStatus,
} from './source';
import { lineStarts, normalizeWork } from './text';

/** A ready snapshot, or the tool result explaining why there is none. */
export type Opened<T> =
  | { ok: true; value: T }
  | { ok: false; result: CallToolResult };

/** The tool result for a snapshot that is not ready. */
export const notReadyResult = (
  work: string,
  status: Exclude<WorkSnapshotStatus, ReadyWorkSnapshot>,
): CallToolResult => {
  switch (status.status) {
    case 'generating':
      // Not an error: the snapshot is on its way and the call should be repeated.
      return textResult(
        `The draft snapshot of ${work} is being generated. Call again in about ${status.retryAfterSeconds} s.`,
      );
    case 'failed':
      return errorResult(
        `Generating the draft snapshot of ${work} failed: ${status.error}. It can be retried in ${status.retryAfterSeconds} s.`,
      );
    case 'not-found':
      return errorResult(
        `No work matches "${work}". Pass a Toh key such as "toh8" or a work uuid; \`resolve-toh\` resolves superseded numbers.`,
      );
    default:
      return errorResult(status.error);
  }
};

/** Ensure a work's snapshot, authorizing the caller. */
export const openSnapshot = async (
  source: WorkSnapshotSource,
  work: string,
  options?: { download?: boolean },
): Promise<Opened<ReadyWorkSnapshot>> => {
  const key = normalizeWork(work);
  const status = await source.ensure(key, options);
  if (status.status !== 'ready') {
    return { ok: false, result: notReadyResult(key, status) };
  }
  return { ok: true, value: status };
};

/** Ensure a work's snapshot and load its files. */
export const openSnapshotFiles = async (
  source: WorkSnapshotSource,
  work: string,
): Promise<
  Opened<{ snapshot: ReadyWorkSnapshot; files: WorkSnapshotFiles }>
> => {
  const opened = await openSnapshot(source, work);
  if (!opened.ok) return opened;
  const loaded = await source.files(opened.value);
  if (!loaded) {
    return {
      ok: false,
      result: errorResult(
        `The draft snapshot of ${normalizeWork(work)} could not be loaded. Try again shortly.`,
      ),
    };
  }
  return { ok: true, value: loaded };
};

const startsMemo = new WeakMap<WorkSnapshotFiles, Map<string, number[]>>();

/** Line start offsets of one file, computed once per loaded tree. */
export const fileLineStarts = (
  files: WorkSnapshotFiles,
  path: string,
  text: string,
): number[] => {
  let byPath = startsMemo.get(files);
  if (!byPath) {
    byPath = new Map();
    startsMemo.set(files, byPath);
  }
  let starts = byPath.get(path);
  if (!starts) {
    starts = lineStarts(text);
    byPath.set(path, starts);
  }
  return starts;
};
