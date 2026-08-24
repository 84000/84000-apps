import type { JSONContent } from '@tiptap/core';
import type { Schema } from '@tiptap/pm/model';
import { Doc, applyUpdate } from 'yjs';
import { PassageDoc } from './passage-doc';
import type { PassageLoader, PassageSnapshot } from './loader';
import type { SpineRange } from './types';

export type PassageDocStoreOptions = {
  workUuid: string;
  schema: Schema;
  loader?: PassageLoader;
  /** Passed through to every document this store creates. */
  textOrigins?: Set<unknown>;
};

/**
 * The set of passage documents currently in memory.
 *
 * Documents are created on demand and released when they leave the window, so
 * what this holds is the window, not the work. A passage with unsynced edits
 * is the one exception: releasing it would drop the only copy of work that has
 * not reached storage, so `release` refuses.
 */
export class PassageDocStore {
  readonly workUuid: string;

  private schema: Schema;
  private loader?: PassageLoader;
  private textOrigins?: Set<unknown>;
  private docs = new Map<string, PassageDoc>();
  private unobservers = new Map<string, () => void>();
  private dirtyUuids = new Set<string>();
  private listeners = new Set<() => void>();
  private inFlight = new Map<string, Promise<PassageDoc | null>>();

  constructor(options: PassageDocStoreOptions) {
    this.workUuid = options.workUuid;
    this.schema = options.schema;
    this.loader = options.loader;
    this.textOrigins = options.textOrigins;
  }

  // ------------------------------------------------------------- reading

  /** The document for a passage, if it is currently held. */
  peek(uuid: string): PassageDoc | null {
    return this.docs.get(uuid) ?? null;
  }

  /** Whether a passage's document is currently in memory. */
  has(uuid: string): boolean {
    return this.docs.has(uuid);
  }

  /** How many documents are held. The number the window bounds. */
  get size(): number {
    return this.docs.size;
  }

  /** Passages holding local edits that have not been synced. */
  dirty(): string[] {
    return [...this.dirtyUuids];
  }

  /** Whether any held passage has unsynced edits. */
  get isDirty(): boolean {
    return this.dirtyUuids.size > 0;
  }

  // ------------------------------------------------------------ creating

  /**
   * The document for a passage, created empty if it is not held.
   *
   * Synchronous, so structural operations and command-log replay can reach a
   * passage without awaiting. Hydration from a source is `hydrate`.
   */
  ensure(uuid: string): PassageDoc {
    const existing = this.docs.get(uuid);
    if (existing) return existing;

    const doc = new PassageDoc({
      uuid,
      workUuid: this.workUuid,
      schema: this.schema,
      textOrigins: this.textOrigins,
    });
    this.adopt(doc);
    return doc;
  }

  /** Create a passage's document from row content. */
  create(uuid: string, content: JSONContent[]): PassageDoc {
    const doc = this.ensure(uuid);
    doc.seed(content);
    return doc;
  }

  /**
   * Load a passage's document from the loader, if it is not already held.
   *
   * Concurrent calls for the same passage share one load — a window that
   * moves while a previous window is still resolving must not build the same
   * document twice and discard one of them.
   */
  async hydrate(uuid: string): Promise<PassageDoc | null> {
    const held = this.docs.get(uuid);
    if (held) return held;

    const pending = this.inFlight.get(uuid);
    if (pending) return pending;

    const load = this.hydrateMany([uuid]).then(
      () => this.docs.get(uuid) ?? null,
    );
    this.inFlight.set(uuid, load);
    try {
      return await load;
    } finally {
      this.inFlight.delete(uuid);
    }
  }

  /**
   * Load every passage in `uuids` that is not already held.
   *
   * One call to the loader for the whole set: the local store reads them in a
   * single transaction and the network fetches them in a single request, both
   * of which a per-passage loop would give up.
   */
  async hydrateMany(uuids: string[]): Promise<PassageDoc[]> {
    const wanted = uuids.filter((uuid) => !this.docs.has(uuid));
    if (!wanted.length) {
      return uuids.flatMap((uuid) => {
        const doc = this.docs.get(uuid);
        return doc ? [doc] : [];
      });
    }
    if (!this.loader) {
      console.error('cannot hydrate passages: no loader configured');
      return [];
    }

    const { snapshots } = await this.loader.load(this.workUuid, wanted);
    snapshots.forEach((snapshot) => this.adoptSnapshot(snapshot));

    return uuids.flatMap((uuid) => {
      const doc = this.docs.get(uuid);
      return doc ? [doc] : [];
    });
  }

  /** Build a document from a snapshot, whichever form the source gave. */
  adoptSnapshot(snapshot: PassageSnapshot): PassageDoc {
    const held = this.docs.get(snapshot.uuid);
    if (held) {
      if (snapshot.doc) held.applyRemote(snapshot.doc);
      return held;
    }

    if (snapshot.doc) {
      const ydoc = new Doc();
      applyUpdate(ydoc, snapshot.doc);
      const doc = new PassageDoc({
        uuid: snapshot.uuid,
        workUuid: this.workUuid,
        schema: this.schema,
        doc: ydoc,
        textOrigins: this.textOrigins,
      });
      this.adopt(doc);
      return doc;
    }

    return this.create(snapshot.uuid, snapshot.content ?? []);
  }

  // ----------------------------------------------------------- releasing

  /**
   * Release a passage's document.
   *
   * Refuses while the passage is dirty, and says so: a released document is
   * gone, and the unsynced edits in it are the one thing this model cannot
   * re-fetch. Returns whether it was released.
   */
  release(uuid: string): boolean {
    const doc = this.docs.get(uuid);
    if (!doc) return false;
    if (doc.isDirty) return false;

    this.unobservers.get(uuid)?.();
    this.unobservers.delete(uuid);
    this.docs.delete(uuid);
    this.dirtyUuids.delete(uuid);
    doc.destroy();
    this.notify();
    return true;
  }

  /**
   * Release every held document outside `keep`.
   *
   * The counterpart to hydrating a window: as the window moves, what fell out
   * of it is dropped. Dirty passages stay, so a passage edited and scrolled
   * past keeps its edits until they are synced.
   *
   * Returns the uuids actually released.
   */
  releaseOutside(keep: Iterable<string>): string[] {
    const kept = new Set(keep);
    const released: string[] = [];
    [...this.docs.keys()].forEach((uuid) => {
      if (kept.has(uuid)) return;
      if (this.release(uuid)) released.push(uuid);
    });
    return released;
  }

  /** Release everything, dirty passages included. For teardown only. */
  destroy() {
    this.docs.forEach((doc, uuid) => {
      this.unobservers.get(uuid)?.();
      doc.destroy();
    });
    this.docs.clear();
    this.unobservers.clear();
    this.dirtyUuids.clear();
    this.listeners.clear();
  }

  // --------------------------------------------------------- observation

  /** Observe hydration, release, and dirty-state changes. */
  observe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ------------------------------------------------------------- private

  private adopt(doc: PassageDoc) {
    this.docs.set(doc.uuid, doc);
    this.unobservers.set(
      doc.uuid,
      doc.observe(() => {
        const wasDirty = this.dirtyUuids.has(doc.uuid);
        if (doc.isDirty && !wasDirty) this.dirtyUuids.add(doc.uuid);
        else if (!doc.isDirty && wasDirty) this.dirtyUuids.delete(doc.uuid);
        this.notify();
      }),
    );
    if (doc.isDirty) this.dirtyUuids.add(doc.uuid);
    this.notify();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

/** The uuids a window covers, given a spine slice. */
export const windowUuids = (uuids: string[], range: SpineRange): string[] =>
  uuids.slice(Math.max(0, range.start), Math.max(0, range.end));
