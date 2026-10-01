import type { PassageDocStore } from './doc-store';
import type { PassageLoader } from './loader';
import type { PassageDoc } from './passage-doc';
import type { Spine } from './spine';
import type { SpineRange } from './types';

/** The window key a single-view consumer gets without asking for one. */
const DEFAULT_WINDOW = 'default';

/** The ranges each view of a work has open, and the documents they hold. */
export class HydrationWindows {
  /** Ranges each view currently has on screen, so hydration is their union. */
  /**
   * What each view currently has on screen, so hydration is their union.
   *
   * Passages rather than positions: a position is an index into a list the
   * other views are appending to, so a window recorded as `100..130` stops
   * meaning the same passages the moment another section loads a page.
   */
  private windows = new Map<string, { uuids: string[]; keep: Set<string> }>();

  private spine: Spine;
  private store: PassageDocStore;
  private loader?: PassageLoader;
  private notify: () => void;

  constructor(options: {
    spine: Spine;
    store: PassageDocStore;
    loader?: PassageLoader;
    notify: () => void;
  }) {
    this.spine = options.spine;
    this.store = options.store;
    this.loader = options.loader;
    this.notify = options.notify;
  }

  /** See `WorkDocument.hydrateWindow`. */
  async hydrate(
    range: SpineRange,
    options: { keep?: Iterable<string>; key?: string } = {},
  ): Promise<PassageDoc[]> {
    const key = options.key ?? DEFAULT_WINDOW;
    const mine = this.windowUuids(range);
    this.windows.set(key, { uuids: mine, keep: new Set(options.keep ?? []) });

    // The union of every open window. Views onto one work scroll
    // independently — the editor draws a tab per panel — so releasing what
    // this one has left behind would release what another one is drawing.
    const wanted = new Set<string>();
    this.windows.forEach((window) => {
      window.uuids.forEach((uuid) => wanted.add(uuid));
      window.keep.forEach((uuid) => wanted.add(uuid));
    });

    const docs = await this.store.hydrateMany([...wanted]);
    this.store.releaseOutside(wanted);
    this.notify();

    // Only this window's documents come back: a consumer attaches its own
    // bookkeeping to what it draws, and two of them observing one document
    // would record every edit to it twice.
    const drawn = new Set(mine);
    return docs.filter((doc) => drawn.has(doc.uuid));
  }

  /** Forget a window, so what only it held can be released. */
  release(key: string) {
    this.windows.delete(key);
  }

  /** Forget every window. */
  clear() {
    this.windows.clear();
  }

  private windowUuids(range: SpineRange): string[] {
    const buffered = this.loader?.bufferedRange(range) ?? range;
    return this.spine.slice(buffered).map((entry) => entry.uuid);
  }
}
