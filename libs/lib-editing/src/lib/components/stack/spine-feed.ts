import type { GraphQLClient } from 'graphql-request';
import { getPassageMetaPage } from '@eightyfourthousand/client-graphql';
import type {
  Spine,
  SpineSeed,
  WorkDocument,
} from '@eightyfourthousand/lib-doc-model';

/** How many passages to put in the spine before the reader asks for more. */
const FIRST_PAGE = 100;
/** How many to add each time the window nears an end of what is loaded. */
const NEXT_PAGE = 100;
/**
 * How close the visible range may come to an end of the loaded spine before
 * the next page is fetched. Wide enough that a fast scroll reaches loaded rows
 * rather than the end of the list.
 */
const EXTEND_THRESHOLD = 40;

type Meta = { uuid: string; label: string; type: string; toh?: string };

/**
 * Grows a work's spine a page at a time.
 *
 * The spine is *not* the whole work. Seeding it completely means one request
 * per hundred passages, and production's two largest works are 15,904 and
 * 15,357 passages — 160 and 154 sequential round trips, unparallelisable
 * because each cursor is the previous page's last uuid. Since 90% of works are
 * under 900 passages, paying that cost for every work to serve the tail is the
 * wrong trade.
 *
 * It is a *window*, not a prefix: it usually opens at the first passage and
 * grows downward, but `reveal` rebuilds it around a passage anywhere in the
 * work, after which it grows in both directions. That is what lets a deep link
 * reach passage 15,000 in one request instead of a hundred and fifty.
 *
 * What this costs: the stack knows only about the passages it has loaded, so
 * the scrollbar grows as the reader scrolls rather than being right at open.
 * That is the same behaviour the current editor has, and unlike the current
 * editor it holds no content for the passages it has not reached.
 *
 * The eventual fix is not more of this — it is the local store holding a spine
 * across sessions, so the pages are fetched once per work rather than once per
 * visit. That does not exist yet, which is why this stays deliberately simple.
 */
export class SpineFeed {
  /** Read backward from here. Undefined once the spine holds the first passage. */
  private startCursor?: string;
  /** Read forward from here. */
  private endCursor?: string;
  private noneBefore = true;
  private noneAfter = false;
  private forward: Promise<number> | null = null;
  private backward: Promise<number> | null = null;

  constructor(
    private readonly work: WorkDocument,
    private readonly client: GraphQLClient,
  ) {}

  /** Whether the work has passages after the ones this spine holds. */
  get hasMore(): boolean {
    return !this.noneAfter;
  }

  /** Whether it has passages before them — only after a `reveal`. */
  get hasMoreBefore(): boolean {
    return !this.noneBefore;
  }

  /**
   * Load the first page, if the spine is empty.
   *
   * A spine restored from elsewhere is left alone — this only fills one that
   * has nothing in it, and reports how many passages it now holds.
   */
  async seed(): Promise<number> {
    if (this.work.spine.length > 0) {
      // Somebody else populated it; assume they know where it ends.
      this.noneAfter = true;
      return this.work.spine.length;
    }
    return this.extend(FIRST_PAGE);
  }

  /**
   * Append the next page. Concurrent calls share one request, so a burst of
   * scroll events cannot append the same page twice.
   */
  extend(limit = NEXT_PAGE): Promise<number> {
    if (this.noneAfter) return Promise.resolve(this.work.spine.length);
    if (this.forward) return this.forward;

    this.forward = this.fetchAfter(limit).finally(() => {
      this.forward = null;
    });
    return this.forward;
  }

  /** Prepend the previous page. Only ever needed after a `reveal`. */
  extendBefore(limit = NEXT_PAGE): Promise<number> {
    if (this.noneBefore) return Promise.resolve(this.work.spine.length);
    if (this.backward) return this.backward;

    this.backward = this.fetchBefore(limit).finally(() => {
      this.backward = null;
    });
    return this.backward;
  }

  /**
   * Extend if the visible range is running out of loaded spine.
   *
   * Returns whether a fetch was started, so a caller can avoid re-rendering
   * for a no-op.
   */
  maybeExtend(visibleEnd: number): boolean {
    if (this.noneAfter || this.forward) return false;
    if (visibleEnd < this.work.spine.length - EXTEND_THRESHOLD) return false;
    void this.extend();
    return true;
  }

  /**
   * The same at the top of a spine that starts mid-work — but only once the
   * reader has actually reached it.
   *
   * Downward has a wide threshold because a fast scroll must land on loaded
   * rows. Upward cannot: prepending moves every row below it, so doing it
   * speculatively would shift the page under a reader who never asked to go
   * up — including right after a deep link, which lands mid-window.
   */
  maybeExtendBefore(visibleStart: number): boolean {
    if (this.noneBefore || this.backward) return false;
    if (visibleStart > 0) return false;
    void this.extendBefore();
    return true;
  }

  /**
   * The index of a passage, loading it into the spine if it is not there.
   *
   * A deep link names a passage, not a position, and the target is usually
   * outside a spine that has only ever grown from the top. Rather than paging
   * to it — a hundred and fifty requests, for the largest works — the spine is
   * rebuilt around it in one, and grows from there in both directions.
   *
   * Returns -1 when the work has no such passage.
   */
  async reveal(uuid: string): Promise<number> {
    const loaded = this.work.spine.indexOf(uuid);
    if (loaded >= 0) return loaded;

    const page = await getPassageMetaPage({
      client: this.client,
      uuid: this.work.workUuid,
      cursor: uuid,
      limit: FIRST_PAGE,
      direction: 'AROUND',
    });
    if (!page.metas.length) return -1;

    this.work.spine.seed(page.metas as SpineSeed[]);
    this.startCursor = page.prevCursor;
    this.endCursor = page.nextCursor;
    this.noneBefore = !page.hasMoreBefore || !page.prevCursor;
    this.noneAfter = !page.hasMoreAfter || !page.nextCursor;

    return this.work.spine.indexOf(uuid);
  }

  private async fetchAfter(limit: number): Promise<number> {
    const page = await getPassageMetaPage({
      client: this.client,
      uuid: this.work.workUuid,
      cursor: this.endCursor,
      limit,
    });

    if (!page.metas.length) {
      // Either the work ended or the read failed. Both mean stop: appending
      // after a hole would put the spine out of order, and order is the one
      // thing it cannot be wrong about.
      this.noneAfter = true;
      return this.work.spine.length;
    }

    appendToSpine(this.work.spine, page.metas);
    this.endCursor = page.nextCursor;
    if (!page.hasMoreAfter || !page.nextCursor) this.noneAfter = true;

    return this.work.spine.length;
  }

  private async fetchBefore(limit: number): Promise<number> {
    const page = await getPassageMetaPage({
      client: this.client,
      uuid: this.work.workUuid,
      cursor: this.startCursor,
      limit,
      direction: 'BACKWARD',
    });

    if (!page.metas.length) {
      this.noneBefore = true;
      return this.work.spine.length;
    }

    prependToSpine(this.work.spine, page.metas);
    this.startCursor = page.prevCursor;
    if (!page.hasMoreBefore || !page.prevCursor) this.noneBefore = true;

    return this.work.spine.length;
  }
}

/**
 * Append server metadata to the end of a spine, as one transaction.
 *
 * Renumbering is off: these labels *are* the server's, so recomputing them
 * would overwrite the truth with a guess derived from a partial spine.
 */
export const appendToSpine = (spine: Spine, metas: Meta[]) => {
  // `doc.transact` rather than yjs's free `transact`: a runtime yjs import in
  // this package risks a second copy of the library alongside the one
  // `lib-doc-model` loads, and a dual-loaded yjs breaks its constructor checks.
  spine.doc.transact(() => {
    metas.forEach((meta) => {
      if (spine.indexOf(meta.uuid) >= 0) return;
      spine.insert(meta as Parameters<Spine['insert']>[0], spine.length, {
        renumber: false,
      });
    });
  });
};

/** The same, at the front, keeping the page's own order. */
export const prependToSpine = (spine: Spine, metas: Meta[]) => {
  spine.doc.transact(() => {
    let at = 0;
    metas.forEach((meta) => {
      if (spine.indexOf(meta.uuid) >= 0) return;
      spine.insert(meta as Parameters<Spine['insert']>[0], at, {
        renumber: false,
      });
      at += 1;
    });
  });
};
