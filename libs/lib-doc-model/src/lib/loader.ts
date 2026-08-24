import type { JSONContent } from '@tiptap/core';
import type { PassageMeta, SpineRange } from './types';

/**
 * What a source can supply for one passage.
 *
 * Either an encoded Yjs document — the normal case once a passage has been
 * edited — or row content, which is what a passage that has never had a
 * document looks like. A source that has neither omits the passage entirely
 * rather than returning an empty snapshot, so a caller can tell "not here"
 * from "here and empty".
 */
export type PassageSnapshot = {
  uuid: string;
  /** Encoded Yjs document state. */
  doc?: Uint8Array;
  /** Row content, used to seed a passage that has no document yet. */
  content?: JSONContent[];
};

/**
 * Somewhere passage documents can be read from.
 *
 * Two implementations are expected: local storage
 * (`@eightyfourthousand/lib-persistence`) and the GraphQL API. The interface
 * is here, and both implementations are outside, because the doc model must
 * not depend on either — that is what lets a route handler hydrate documents
 * with no browser storage in reach.
 */
export type PassageSource = {
  /** A name for diagnostics — which source answered, which one was skipped. */
  readonly name: string;
  /**
   * Return what this source has for `uuids`. Missing passages are omitted;
   * the loader asks the next source for those.
   */
  loadPassages(workUuid: string, uuids: string[]): Promise<PassageSnapshot[]>;
  /** The work's spine, encoded, or null when this source does not have it. */
  loadSpine?(workUuid: string): Promise<Uint8Array | null>;
  /** The work's passage metadata, for seeding a spine that has no document. */
  loadSpineMetas?(workUuid: string): Promise<Omit<PassageMeta, 'matter'>[]>;
};

export type PassageLoaderOptions = {
  /**
   * Sources in the order they are consulted — local cache first, network
   * last. Each is asked only for what the ones before it did not have.
   */
  sources: PassageSource[];
  /**
   * Called with snapshots that came from anything but the first source, so
   * the local cache can absorb them. Failures are logged, not thrown: a
   * passage that loaded but did not cache is still usable.
   */
  cache?: (workUuid: string, snapshots: PassageSnapshot[]) => Promise<void>;
  /**
   * How many passages either side of the visible range to hydrate.
   *
   * The buffer is what makes scrolling not stutter: by the time a passage
   * scrolls into view its document is already in memory. Default 10.
   */
  buffer?: number;
};

/** How a window of passages resolved, for diagnostics and tests. */
export type LoadReport = {
  requested: number;
  /** uuids each source answered for, keyed by source name. */
  bySource: Record<string, string[]>;
  /** uuids no source could supply. */
  missing: string[];
};

/**
 * Resolves passage documents for a window, cheapest source first.
 *
 * The visible window plus a buffer is the unit of hydration, which is the
 * whole reason the model is sharded: a thousand-page work loads the forty
 * passages someone can see rather than all of it.
 */
export class PassageLoader {
  private sources: PassageSource[];
  private cache?: PassageLoaderOptions['cache'];
  private buffer: number;

  constructor(options: PassageLoaderOptions) {
    this.sources = options.sources;
    this.cache = options.cache;
    this.buffer = options.buffer ?? 10;
  }

  /** Widen a visible range by the configured buffer. */
  bufferedRange(range: SpineRange): SpineRange {
    return {
      start: Math.max(0, range.start - this.buffer),
      end: range.end + this.buffer,
    };
  }

  /**
   * Load snapshots for `uuids`, asking each source only for what remains.
   *
   * A source that throws is logged and skipped rather than failing the whole
   * window: a broken local cache should fall through to the network, not
   * leave the reader with a blank page.
   */
  async load(
    workUuid: string,
    uuids: string[],
  ): Promise<{ snapshots: Map<string, PassageSnapshot>; report: LoadReport }> {
    const snapshots = new Map<string, PassageSnapshot>();
    const report: LoadReport = {
      requested: uuids.length,
      bySource: {},
      missing: [],
    };
    let outstanding = [...uuids];

    for (const [index, source] of this.sources.entries()) {
      if (!outstanding.length) break;

      let found: PassageSnapshot[] = [];
      try {
        found = await source.loadPassages(workUuid, outstanding);
      } catch (error) {
        console.error(`passage source ${source.name} failed`, error);
        continue;
      }

      found.forEach((snapshot) => snapshots.set(snapshot.uuid, snapshot));
      report.bySource[source.name] = found.map(({ uuid }) => uuid);

      // Anything past the first source is a cache miss worth writing back.
      if (index > 0 && found.length && this.cache) {
        try {
          await this.cache(workUuid, found);
        } catch (error) {
          console.error('failed to cache fetched passages', error);
        }
      }

      outstanding = outstanding.filter((uuid) => !snapshots.has(uuid));
    }

    report.missing = outstanding;
    if (outstanding.length) {
      console.error(
        `no source supplied ${outstanding.length} passage(s) of work ${workUuid}`,
      );
    }
    return { snapshots, report };
  }

  /** The work's spine, from the first source that has one. */
  async loadSpine(workUuid: string): Promise<Uint8Array | null> {
    for (const source of this.sources) {
      if (!source.loadSpine) continue;
      try {
        const doc = await source.loadSpine(workUuid);
        if (doc) return doc;
      } catch (error) {
        console.error(`spine source ${source.name} failed`, error);
      }
    }
    return null;
  }

  /** The work's passage metadata, from the first source that has it. */
  async loadSpineMetas(
    workUuid: string,
  ): Promise<Omit<PassageMeta, 'matter'>[]> {
    for (const source of this.sources) {
      if (!source.loadSpineMetas) continue;
      try {
        const metas = await source.loadSpineMetas(workUuid);
        if (metas.length) return metas;
      } catch (error) {
        console.error(`spine meta source ${source.name} failed`, error);
      }
    }
    return [];
  }
}
