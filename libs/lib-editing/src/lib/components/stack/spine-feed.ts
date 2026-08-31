import type { GraphQLClient } from 'graphql-request';
import { getPassageMetaPage } from '@eightyfourthousand/client-graphql';
import type { Spine, WorkDocument } from '@eightyfourthousand/lib-doc-model';

/** How many passages to put in the spine before the reader asks for more. */
const FIRST_PAGE = 100;
/** How many to append each time the window nears the end of what is loaded. */
const NEXT_PAGE = 100;
/**
 * How close the visible range may come to the end of the loaded spine before
 * the next page is fetched. Wide enough that a fast scroll reaches loaded rows
 * rather than the end of the list.
 */
const EXTEND_THRESHOLD = 40;

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
  private cursor?: string;
  private exhausted = false;
  private inFlight: Promise<number> | null = null;

  constructor(
    private readonly work: WorkDocument,
    private readonly client: GraphQLClient,
  ) {}

  /** Whether the work has passages this spine has not loaded. */
  get hasMore(): boolean {
    return !this.exhausted;
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
      this.exhausted = true;
      return this.work.spine.length;
    }
    return this.extend(FIRST_PAGE);
  }

  /**
   * Append the next page. Concurrent calls share one request, so a burst of
   * scroll events cannot append the same page twice.
   */
  extend(limit = NEXT_PAGE): Promise<number> {
    if (this.exhausted) return Promise.resolve(this.work.spine.length);
    if (this.inFlight) return this.inFlight;

    this.inFlight = this.fetch(limit).finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /**
   * Extend if the visible range is running out of loaded spine.
   *
   * Returns whether a fetch was started, so a caller can avoid re-rendering
   * for a no-op.
   */
  maybeExtend(visibleEnd: number): boolean {
    if (this.exhausted || this.inFlight) return false;
    if (visibleEnd < this.work.spine.length - EXTEND_THRESHOLD) return false;
    void this.extend();
    return true;
  }

  private async fetch(limit: number): Promise<number> {
    const page = await getPassageMetaPage({
      client: this.client,
      uuid: this.work.workUuid,
      cursor: this.cursor,
      limit,
    });

    if (!page.metas.length) {
      // Either the work ended or the read failed. Both mean stop: appending
      // after a hole would put the spine out of order, and order is the one
      // thing it cannot be wrong about.
      this.exhausted = true;
      return this.work.spine.length;
    }

    appendToSpine(this.work.spine, page.metas);
    this.cursor = page.nextCursor;
    if (!page.hasMoreAfter || !page.nextCursor) this.exhausted = true;

    return this.work.spine.length;
  }
}

/**
 * Append server metadata to the end of a spine, as one transaction.
 *
 * Renumbering is off: these labels *are* the server's, so recomputing them
 * would overwrite the truth with a guess derived from a partial spine.
 */
export const appendToSpine = (
  spine: Spine,
  metas: { uuid: string; label: string; type: string; toh?: string }[],
) => {
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
