import type { PassageMeta } from '@eightyfourthousand/lib-doc-model';

import type { StackController } from './StackController';

/** Rows read a batch at a time, released before the next. */
const PRINT_BATCH = 200;

/** Reads started, for their windows' keys. */
let reads = 0;

/** A row as printed: its metadata and its static HTML. */
export type StackPrintRow = { meta: PassageMeta; html: string };

/** Rows read so far, out of those known so far. */
export type StackPrintProgress = { loaded: number; total: number };

/**
 * Every row of a view's run, read for printing.
 *
 * The run is grown to both its ends, and its documents are read a batch at a
 * time and released, so a long work never sits in memory whole. Resolves to
 * null when cancelled, or when a row's content could not be read.
 */
export const readStackForPrint = async (
  controller: StackController,
  {
    onProgress,
    signal,
  }: {
    onProgress?: (progress: StackPrintProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<StackPrintRow[] | null> => {
  const stopped = () => !!signal?.aborted;
  const report = (loaded: number) =>
    onProgress?.({ loaded, total: controller.getOrder().length });

  await controller.loadWholeRun({ stopped, onPage: () => report(0) });
  if (stopped()) return null;

  const { work } = controller;
  const { spine } = work;
  const order = controller.getOrder();
  // Its own, per read: another read releasing its window must not take this
  // one's documents with it.
  const key = `print:${controller.getTab() ?? 'default'}:${++reads}`;
  const rows: StackPrintRow[] = [];
  report(0);
  try {
    for (let start = 0; start < order.length; ) {
      if (stopped()) return null;
      // Positions taken afresh each batch, as another section's run can grow
      // meanwhile and move this one along the spine.
      const position = new Map(spine.uuids().map((uuid, i) => [uuid, i]));
      const at = (uuid: string) => position.get(uuid) ?? -1;
      // A batch spans at most `PRINT_BATCH` spine entries, rows hidden for the
      // Toh included, so it holds no more documents than that.
      const first = at(order[start]);
      let end = start + 1;
      while (end < order.length && at(order[end]) - first < PRINT_BATCH) {
        end++;
      }
      const batch = order.slice(start, end);
      start = end;
      // Rows drawn from given HTML have no document to read.
      const unread = batch.some(
        (uuid) =>
          !work.store.has(uuid) && controller.readStaticHTML(uuid) === null,
      );
      if (unread) {
        // The whole batch, held ones included: the windows holding those can
        // move before this reads them.
        const last = at(batch[batch.length - 1]);
        await work.hydrateWindow(
          { start: Math.max(0, first), end: Math.max(first, last) + 1 },
          { key },
        );
      }
      for (const uuid of batch) {
        const meta = controller.getMeta(uuid);
        const html = controller.readStaticHTML(uuid);
        if (!meta || html === null) return null;
        rows.push({ meta, html });
      }
      report(rows.length);
    }
  } finally {
    // The last batch stays held until the reader's own windows next move.
    work.releaseWindow(key);
  }
  return stopped() ? null : rows;
};
