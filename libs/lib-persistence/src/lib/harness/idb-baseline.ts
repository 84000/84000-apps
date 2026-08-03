/**
 * An IndexedDB store shaped like the SQLite one, for comparison.
 *
 * IndexedDB is a serious rejected alternative, not a strawman, so this is
 * written the way we would actually ship it. Two choices follow from that:
 *
 * 1. Each journal append is its own transaction, because that is what "the edit
 *    is durable now" requires. Batching would make IndexedDB look faster while
 *    measuring something we could not use.
 * 2. Durability-sensitive writes use `durability: 'strict'`, which asks the
 *    browser to flush before reporting the transaction complete. The default is
 *    relaxed, and benchmarking relaxed IndexedDB against `synchronous = FULL`
 *    SQLite would be comparing a durable write to a non-durable one.
 */

const DB_NAME = '84000-baseline';
const DB_VERSION = 1;
const DOCS = 'passage_docs';
const JOURNAL = 'journal';

const promisify = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

const done = (tx: IDBTransaction): Promise<void> =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });

/** Minimal IndexedDB equivalent of the passage-doc and journal stores. */
export class IdbBaseline {
  #db: IDBDatabase | null = null;

  async open(): Promise<number> {
    const started = performance.now();
    this.#db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DOCS)) {
          db.createObjectStore(DOCS, { keyPath: 'uuid' });
        }
        if (!db.objectStoreNames.contains(JOURNAL)) {
          db.createObjectStore(JOURNAL, {
            keyPath: 'id',
            autoIncrement: true,
          });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return performance.now() - started;
  }

  #require(): IDBDatabase {
    if (!this.#db) throw new Error('lib-persistence: baseline is not open');
    return this.#db;
  }

  async putPassageDoc(uuid: string, doc: Uint8Array): Promise<void> {
    const tx = this.#require().transaction(DOCS, 'readwrite', {
      durability: 'strict',
    });
    tx.objectStore(DOCS).put({ uuid, doc });
    await done(tx);
  }

  /** Bulk load in a single transaction, mirroring `putPassageDocs`. */
  async putPassageDocs(
    records: { uuid: string; doc: Uint8Array }[],
  ): Promise<void> {
    const tx = this.#require().transaction(DOCS, 'readwrite', {
      durability: 'strict',
    });
    const store = tx.objectStore(DOCS);
    for (const record of records) store.put(record);
    await done(tx);
  }

  async getPassageDoc(uuid: string): Promise<Uint8Array | null> {
    const tx = this.#require().transaction(DOCS, 'readonly');
    const record = await promisify(
      tx.objectStore(DOCS).get(uuid) as IDBRequest<{ doc: Uint8Array }>,
    );
    return record?.doc ?? null;
  }

  /** One strict transaction per append — see the note at the top of this file. */
  async appendJournal(update: Uint8Array): Promise<void> {
    const tx = this.#require().transaction(JOURNAL, 'readwrite', {
      durability: 'strict',
    });
    tx.objectStore(JOURNAL).add({ update });
    await done(tx);
  }

  async journalCount(): Promise<number> {
    const tx = this.#require().transaction(JOURNAL, 'readonly');
    return promisify(tx.objectStore(JOURNAL).count());
  }

  async clear(): Promise<void> {
    const tx = this.#require().transaction([DOCS, JOURNAL], 'readwrite');
    tx.objectStore(DOCS).clear();
    tx.objectStore(JOURNAL).clear();
    await done(tx);
  }

  close(): void {
    this.#db?.close();
    this.#db = null;
  }
}
