const MAX_SAMPLES = 500;

export type StackPerfSnapshot = {
  keystroke: { p50: number; p95: number; max: number; count: number };
  mount: { avg: number; max: number; count: number };
  skippedUndos: number;
};

const percentile = (sorted: number[], p: number) => {
  if (!sorted.length) return 0;
  const idx = Math.min(
    sorted.length - 1,
    Math.floor((p / 100) * sorted.length),
  );
  return sorted[idx];
};

/**
 * In-memory metrics for the passage-stack spike: keystroke-to-paint latency,
 * editor mount cost, and undo entries dropped because their history was lost
 * to unmounting. Read by the PerfHUD; not wired to any analytics.
 */
class StackPerf {
  private keystrokes: number[] = [];
  private mounts: number[] = [];
  private skipped = 0;
  private listeners = new Set<() => void>();
  private version = 0;
  private snapshotCache: { version: number; value: StackPerfSnapshot } | null =
    null;

  recordKeystroke(ms: number) {
    this.push(this.keystrokes, ms);
  }

  recordMount(ms: number) {
    this.push(this.mounts, ms);
  }

  recordSkippedUndo() {
    this.skipped += 1;
    this.bump();
  }

  reset() {
    this.keystrokes = [];
    this.mounts = [];
    this.skipped = 0;
    this.bump();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getVersion = () => this.version;

  snapshot = (): StackPerfSnapshot => {
    if (this.snapshotCache?.version === this.version) {
      return this.snapshotCache.value;
    }

    const sorted = [...this.keystrokes].sort((a, b) => a - b);
    const value = {
      keystroke: {
        p50: percentile(sorted, 50),
        p95: percentile(sorted, 95),
        max: sorted[sorted.length - 1] ?? 0,
        count: sorted.length,
      },
      mount: {
        avg: this.mounts.length
          ? this.mounts.reduce((a, b) => a + b, 0) / this.mounts.length
          : 0,
        max: Math.max(0, ...this.mounts),
        count: this.mounts.length,
      },
      skippedUndos: this.skipped,
    };
    this.snapshotCache = { version: this.version, value };
    return value;
  };

  private push(samples: number[], ms: number) {
    samples.push(ms);
    if (samples.length > MAX_SAMPLES) samples.shift();
    this.bump();
  }

  private bump() {
    this.version += 1;
    this.listeners.forEach((listener) => listener());
  }
}

export const stackPerf = new StackPerf();
