'use client';

import { useSyncExternalStore } from 'react';

import { PassageStackController } from './PassageStackController';
import { stackPerf } from './perf';

const ms = (value: number) => `${value.toFixed(1)}ms`;

/**
 * Floating readout of the spike's exit-criteria numbers: typing latency,
 * editor mount cost, mounted-editor count, and undo history lost to
 * unmounting.
 */
export const PerfHUD = ({
  controller,
}: {
  controller: PassageStackController;
}) => {
  useSyncExternalStore(
    stackPerf.subscribe,
    stackPerf.getVersion,
    stackPerf.getVersion,
  );
  useSyncExternalStore(
    controller.subscribe,
    controller.getVersion,
    controller.getVersion,
  );

  const { keystroke, mount, skippedUndos } = stackPerf.snapshot();

  return (
    <div className="fixed bottom-4 right-4 z-50 rounded-md border bg-background/90 p-3 font-mono text-xs shadow-lg backdrop-blur">
      <div className="mb-1 font-semibold">passage stack</div>
      <table>
        <tbody>
          <tr>
            <td className="pr-3 text-muted-foreground">passages</td>
            <td>{controller.passageCount()}</td>
          </tr>
          <tr>
            <td className="pr-3 text-muted-foreground">mounted</td>
            <td>{controller.mountedCount()}</td>
          </tr>
          <tr>
            <td className="pr-3 text-muted-foreground">key p50 / p95 / max</td>
            <td>
              {ms(keystroke.p50)} / {ms(keystroke.p95)} / {ms(keystroke.max)}{' '}
              <span className="text-muted-foreground">
                (n={keystroke.count})
              </span>
            </td>
          </tr>
          <tr>
            <td className="pr-3 text-muted-foreground">mount avg / max</td>
            <td>
              {ms(mount.avg)} / {ms(mount.max)}{' '}
              <span className="text-muted-foreground">(n={mount.count})</span>
            </td>
          </tr>
          <tr>
            <td className="pr-3 text-muted-foreground">undo depth</td>
            <td>{controller.undoDepth()}</td>
          </tr>
          <tr>
            <td className="pr-3 text-muted-foreground">lost undo entries</td>
            <td>{skippedUndos}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
