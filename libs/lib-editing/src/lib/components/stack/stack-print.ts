import type { PassageMeta } from '@eightyfourthousand/lib-doc-model';

import type { StackController } from './StackController';

/** Rows read a batch at a time, released before the next. */
const PRINT_BATCH = 200;

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
  const order = controller.getOrder();
  const key = `print:${controller.getTab() ?? 'default'}`;
  const rows: StackPrintRow[] = [];
  report(0);
  try {
    for (let start = 0; start < order.length; start += PRINT_BATCH) {
      if (stopped()) return null;
      const batch = order.slice(start, start + PRINT_BATCH);
      const unread = batch.filter(
        (uuid) => controller.readStaticHTML(uuid) === null,
      );
      if (unread.length) {
        // A window of its own, so the next batch releases this one while the
        // reader's own windows keep what they show.
        const first = work.spine.indexOf(unread[0]);
        const last = work.spine.indexOf(unread[unread.length - 1]);
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
    work.releaseWindow(key);
  }
  return stopped() ? null : rows;
};
