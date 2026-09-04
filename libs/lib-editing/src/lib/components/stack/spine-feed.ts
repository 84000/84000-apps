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

/** What a feed reads, and where its passages sit in the spine. */
export type SpineSection = {
  /** Passage type pattern, e.g. `BODY_MATTER_FILTER`. */
  type: string;
  /** The tab those passages are placed in, which identifies their run. */
  tab: string;
};

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
    /**
     * The section this feed reads, when a work is loaded a tab at a time.
     *
     * Omitted, it reads the whole work into one run — what the sandbox does.
     * Supplied, its pages join that tab's run and leave the other runs alone,
     * so the panels can load independently of each other.
     */
    private readonly section?: SpineSection,
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
    // Its own run, not the whole spine: another section may have seeded first.
    if (this.runLength() > 0) {
      // Somebody else populated it; assume they know where it ends.
      this.noneAfter = true;
      return this.work.spine.length;
    }
    return this.extend(FIRST_PAGE);
  }

  /** How many passages this feed's section holds. */
  private runLength(): number {
    const tab = this.section?.tab;
    return tab ? this.work.spine.tab(tab).length : this.work.spine.length;
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
    if (visibleEnd < this.runLength() - EXTEND_THRESHOLD) return false;
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
      type: this.section?.type,
    });
    if (!page.metas.length) return -1;

    this.replaceRun(page.metas);
    this.startCursor = page.prevCursor;
    this.endCursor = page.nextCursor;
    this.noneBefore = !page.hasMoreBefore || !page.prevCursor;
    this.noneAfter = !page.hasMoreAfter || !page.nextCursor;

    return this.work.spine.indexOf(uuid);
  }

  /**
   * Swap this feed's passages for a window around the target.
   *
   * A sectioned feed replaces only its own run: the other panels are showing
   * theirs, and seeding the spine would take those with it.
   */
  private replaceRun(metas: Meta[]) {
    const spine = this.work.spine;
    const tab = this.section?.tab;
    if (!tab) {
      spine.seed(metas as SpineSeed[]);
      return;
    }

    const existing = spine.tab(tab).map((entry) => entry.uuid);
    const at = runStart(spine, tab);
    spine.doc.transact(() => {
      if (existing.length) spine.remove(existing, { renumber: false });
      metas.forEach((meta, offset) => {
        spine.insert(meta as Parameters<Spine['insert']>[0], at + offset, {
          renumber: false,
        });
      });
    });
  }

  private async fetchAfter(limit: number): Promise<number> {
    const page = await getPassageMetaPage({
      client: this.client,
      uuid: this.work.workUuid,
      cursor: this.endCursor,
      limit,
      type: this.section?.type,
    });

    if (!page.metas.length) {
      // Either the work ended or the read failed. Both mean stop: appending
      // after a hole would put the spine out of order, and order is the one
      // thing it cannot be wrong about.
      this.noneAfter = true;
      return this.work.spine.length;
    }

    appendToSpine(this.work.spine, page.metas, this.section?.tab);
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
      type: this.section?.type,
    });

    if (!page.metas.length) {
      this.noneBefore = true;
      return this.work.spine.length;
    }

    prependToSpine(this.work.spine, page.metas, this.section?.tab);
    this.startCursor = page.prevCursor;
    if (!page.hasMoreBefore || !page.prevCursor) this.noneBefore = true;

    return this.work.spine.length;
  }
}

/**
 * Where a section's run ends, as an insertion index.
 *
 * Sections do not interleave — `panelAndTabForContentType` puts a passage in
 * exactly one tab, and the tabs follow the work's order — so a run is
 * contiguous and grows at its own end. A run with nothing in it yet goes at
 * the end of the spine, which is why sections must be seeded in the order the
 * work reads.
 */
const runEnd = (spine: Spine, tab?: string): number => {
  if (!tab) return spine.length;
  const uuids = spine.uuids();
  for (let i = uuids.length - 1; i >= 0; i--) {
    if (spine.meta(uuids[i])?.tab === tab) return i + 1;
  }
  return spine.length;
};

/** Where it begins. */
const runStart = (spine: Spine, tab?: string): number => {
  if (!tab) return 0;
  const uuids = spine.uuids();
  for (let i = 0; i < uuids.length; i++) {
    if (spine.meta(uuids[i])?.tab === tab) return i;
  }
  return spine.length;
};

/**
 * Append server metadata to the end of a spine — or of one section's run.
 *
 * Renumbering is off: these labels *are* the server's, so recomputing them
 * would overwrite the truth with a guess derived from a partial spine.
 */
export const appendToSpine = (spine: Spine, metas: Meta[], tab?: string) => {
  // `doc.transact` rather than yjs's free `transact`: a runtime yjs import in
  // this package risks a second copy of the library alongside the one
  // `lib-doc-model` loads, and a dual-loaded yjs breaks its constructor checks.
  spine.doc.transact(() => {
    let at = runEnd(spine, tab);
    metas.forEach((meta) => {
      if (spine.indexOf(meta.uuid) >= 0) return;
      spine.insert(meta as Parameters<Spine['insert']>[0], at, {
        renumber: false,
      });
      at += 1;
    });
  });
};

/** The same, at the front of the run, keeping the page's own order. */
export const prependToSpine = (spine: Spine, metas: Meta[], tab?: string) => {
  spine.doc.transact(() => {
    let at = runStart(spine, tab);
    metas.forEach((meta) => {
      if (spine.indexOf(meta.uuid) >= 0) return;
      spine.insert(meta as Parameters<Spine['insert']>[0], at, {
        renumber: false,
      });
      at += 1;
    });
  });
};
