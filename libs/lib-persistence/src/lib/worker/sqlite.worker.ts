/// <reference lib="webworker" />
/**
 * Dedicated worker entry point: owns one open SQLite database.
 *
 * Exactly one of these has the database open at a time — the one belonging to
 * the tab that currently holds the ownership lock.
 *
 * Clients attach by sending an `attach` message carrying a `MessagePort`; the
 * worker then exposes the database over Comlink on that port. Both the owning
 * tab and any inactive tab the coordinator routes here use the same path, so
 * there is one code path to reason about — and a proxied query talks to this
 * worker directly rather than hopping through the owner tab's main thread,
 * which keeps a busy owner from stalling other tabs' reads.
 *
 * The database is deliberately *not* exposed on `self`. Comlink's protocol and
 * this attach protocol would otherwise share one message channel and each would
 * see the other's traffic as malformed.
 */

import * as Comlink from 'comlink';
import { LocalDatabase } from './database';
import { createOpfsDriver } from './opfs-driver';

/** Message asking the worker to serve a client over `port`. */
export type AttachMessage = { type: 'attach'; port: MessagePort };

const database = new LocalDatabase(createOpfsDriver);

self.addEventListener('message', (event: MessageEvent<AttachMessage>) => {
  if (event.data?.type !== 'attach') return;
  Comlink.expose(database, event.data.port);
  event.data.port.start();
});
