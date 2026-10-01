import type {
  PassageDoc,
  SpineRange,
  WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

import type { PassageStackControllerOptions } from './PassageStackController';

/**
 * A stack view's hydration window: scroll-driven, following the virtualized
 * range, and growing the spine as the reader approaches either end of it.
 */
export class StackHydration {
  private readonly work: WorkDocument;
  private readonly spineFeed?: PassageStackControllerOptions['spineFeed'];
  private readonly tab?: string;
  private readonly windowKey: string;
  private readonly getOrder: () => string[];
  private readonly getLiveUuids: () => Set<string>;
  private readonly wire: (doc: PassageDoc) => void;
  private readonly invalidateOrder: () => void;
  private readonly resetLive: () => void;
  private readonly scrollTo: (
    index: number,
    options?: { settle?: boolean },
  ) => void;
  private readonly bump: () => void;

  private visibleRange: SpineRange = { start: 0, end: 0 };
  private hydrating = false;
  private hydrationQueued = false;

  /**
   * Whether reaching index 0 should pull the previous page.
   *
   * Disarmed by a reveal: the list renders from the top for a frame before the
   * scroll lands, and paging upward then would prepend a hundred rows under a
   * reader who never asked to go up — moving the target out from under the
   * scroll that was about to happen.
   */
  private earlierArmed = true;
  /** In-flight reveals, so a remount does not fetch the same window twice. */
  private revealing = new Map<string, Promise<boolean>>();

  constructor(host: {
    work: WorkDocument;
    spineFeed?: PassageStackControllerOptions['spineFeed'];
    tab?: string;
    windowKey: string;
    getOrder: () => string[];
    getLiveUuids: () => Set<string>;
    wire: (doc: PassageDoc) => void;
    invalidateOrder: () => void;
    resetLive: () => void;
    scrollTo: (index: number, options?: { settle?: boolean }) => void;
    bump: () => void;
  }) {
    this.work = host.work;
    this.spineFeed = host.spineFeed;
    this.tab = host.tab;
    this.windowKey = host.windowKey;
    this.getOrder = host.getOrder;
    this.getLiveUuids = host.getLiveUuids;
    this.wire = host.wire;
    this.invalidateOrder = host.invalidateOrder;
    this.resetLive = host.resetLive;
    this.scrollTo = host.scrollTo;
    this.bump = host.bump;
  }

  /**
   * Whether a window load is in flight.
   *
   * A settled scroll needs this: between issuing the scroll and the content
   * landing the page is perfectly still, and stillness alone cannot tell
   * "finished" from "waiting on the network". Releasing the anchor during that
   * gap is what let a revealed row jump out of view when the last page
   * arrived.
   */
  isHydrating = () => this.hydrating;

  /**
   * Tell the controller which rows the virtualizer is drawing.
   *
   * Hydration is widened by the loader's own buffer, so this is the visible
   * range rather than a padded one. Calls made while a load is in flight
   * collapse into a single follow-up, so a fast scroll issues two loads rather
   * than one per frame.
   */
  setVisibleRange = (range: SpineRange) => {
    if (
      range.start === this.visibleRange.start &&
      range.end === this.visibleRange.end
    ) {
      return;
    }
    this.visibleRange = range;
    // The spine covers only the pages fetched so far, so approaching either
    // end has to pull the next one before there is anything to hydrate.
    this.spineFeed?.maybeExtend(range.end);
    if (range.start > 0) this.earlierArmed = true;
    // Disarmed again by the page it starts: until the view re-anchors on the
    // row that used to be first, the range still reads as index 0 and would
    // ask for another.
    if (this.earlierArmed && this.spineFeed?.maybeExtendBefore?.(range.start)) {
      this.earlierArmed = false;
    }
    void this.runHydration();
  };

  /**
   * This view's range, as spine positions.
   *
   * Rows are indexed within the tab, hydration is indexed within the work.
   * A tab's passages are contiguous in the spine, so the ends are enough.
   */
  private spineRange(range: SpineRange): SpineRange {
    if (!this.tab) return range;
    const order = this.getOrder();
    const first = order[range.start];
    const last = order[Math.max(range.start, range.end - 1)];
    if (!first || !last) return { start: 0, end: 0 };

    const start = this.work.spine.indexOf(first);
    const end = this.work.spine.indexOf(last) + 1;
    return { start: Math.max(0, start), end: Math.max(start, end) };
  }

  /** Whether the work has passages before the ones the spine holds. */
  hasEarlierPassages = () => this.spineFeed?.hasMoreBefore ?? false;

  /** Whether the work has passages the spine has not loaded yet. */
  hasMorePassages = () => this.spineFeed?.hasMore ?? false;

  private async runHydration() {
    if (this.hydrating) {
      this.hydrationQueued = true;
      return;
    }
    this.hydrating = true;
    try {
      do {
        this.hydrationQueued = false;
        // Live editors are pinned: focus does not have to sit inside the
        // scrolled range, and releasing a document under a mounted editor
        // would leave it bound to a destroyed fragment.
        const docs = await this.work.hydrateWindow(
          this.spineRange(this.visibleRange),
          { keep: this.getLiveUuids(), key: this.windowKey },
        );
        docs.forEach((doc) => this.wire(doc));
      } while (this.hydrationQueued);
    } finally {
      this.hydrating = false;
    }
    this.bump();
  }

  /**
   * Scroll a passage into view, loading it into the spine if the window does
   * not hold it.
   *
   * What a deep link resolves to. The target is named, not positioned, so an
   * unknown one rebuilds the spine around itself rather than paging to it.
   * Resolves false when the work has no such passage.
   */
  revealPassage = (uuid: string): Promise<boolean> => {
    const existing = this.revealing.get(uuid);
    if (existing) return existing;

    const run = this.reveal(uuid).finally(() => this.revealing.delete(uuid));
    this.revealing.set(uuid, run);
    return run;
  };

  private async reveal(uuid: string): Promise<boolean> {
    if (this.getOrder().indexOf(uuid) < 0) {
      // Called through the feed, not detached from it — `reveal` is a method
      // and reads the work off `this`.
      if (!this.spineFeed?.reveal) return false;
      // Before the await, not after: the list renders from the top while the
      // window is in flight, and arming would prepend under the scroll that
      // is about to happen.
      this.earlierArmed = false;

      if ((await this.spineFeed.reveal(uuid)) < 0) return false;
      this.invalidateOrder();
      // The spine is a different set of passages now; anything the old one
      // pinned is gone with it.
      this.resetLive();
      this.bump();
    }

    await this.hydrateOne(uuid);

    // Read the position now rather than trusting the one the feed returned:
    // anything that grew the spine in the meantime has moved it.
    const index = this.getOrder().indexOf(uuid);
    if (index < 0) return false;
    // Settled, unlike a focus move: the rows above an unvisited target are
    // estimated, and measuring them moves it — by a screenful, on a deep link.
    this.scrollTo(index, { settle: true });
    return true;
  }

  /** Hydrate one passage on demand — the path focus takes ahead of mounting. */
  async hydrateOne(uuid: string) {
    if (this.work.store.has(uuid)) return;
    const doc = await this.work.store.hydrate(uuid);
    if (doc) {
      this.wire(doc);
      this.bump();
    }
  }
}
