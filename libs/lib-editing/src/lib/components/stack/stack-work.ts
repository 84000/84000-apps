import { getSchema } from '@tiptap/core';
import { ySyncPluginKey } from '@tiptap/y-tiptap';
import type { GraphQLClient } from 'graphql-request';
import type { Doc } from 'yjs';
import {
  WorkDocument,
  type PassageLoader,
  type PassageSnapshot,
  type PassageSource,
} from '@eightyfourthousand/lib-doc-model';

import { createStackLoader } from './passage-source';
import { buildStackSchemaExtensions } from './stack-extensions';

export type StackWorkOptions = {
  workUuid: string;
  loader?: PassageLoader;
  /** An existing spine document, e.g. one restored from local storage. */
  spineDoc?: Doc;
};

/**
 * A `WorkDocument` configured for the editor stack.
 *
 * Two settings the doc model deliberately leaves to its consumer, and which
 * the stack has exactly one right answer for:
 *
 * - **Schema.** Passage documents are parsed and serialized against the same
 *   node set the per-passage editors mount, so split and merge cut content the
 *   editors can render back.
 * - **Text origins.** `PassageDoc` defaults to treating a direct write as the
 *   user's text edit. Edits made through a TipTap editor do not arrive that
 *   way — they carry the y-sync plugin's origin — so without this the passage
 *   `UndoManager` tracks nothing a typist did and Mod-Z silently skips their
 *   typing. It is a quiet failure, which is why it is pinned here rather than
 *   left to each caller.
 */
export const createStackWorkDocument = (options: StackWorkOptions) =>
  new WorkDocument({
    workUuid: options.workUuid,
    schema: getSchema(buildStackSchemaExtensions()),
    loader: options.loader,
    spineDoc: options.spineDoc,
    textOrigins: new Set([ySyncPluginKey]),
  });

/**
 * A stack `WorkDocument` reading through the API, and the local store when one
 * is supplied.
 *
 * The assembly exists because the two halves reference each other: the loader's
 * network source needs the spine to turn a uuid set into a cursor, and the
 * spine belongs to the `WorkDocument` the loader is constructed for. Resolving
 * it through a closure rather than passing the object keeps the cycle to this
 * function — by the time a window is hydrated the document exists, and nothing
 * outside here has to know the order things were built in.
 */
export const createStackWork = ({
  workUuid,
  client,
  local,
  cache,
  buffer,
  spineDoc,
}: {
  workUuid: string;
  client: GraphQLClient;
  /** `localPassageSource(storage)` from `lib-persistence`, when available. */
  local?: PassageSource;
  /** `cachePassageSnapshots(storage)` from `lib-persistence`. */
  cache?: (workUuid: string, snapshots: PassageSnapshot[]) => Promise<void>;
  /** Passages either side of the visible range to hydrate. */
  buffer?: number;
  spineDoc?: Doc;
}): WorkDocument => {
  // A holder rather than a reassigned binding: the loader closes over this
  // before the document exists, and by the time a window is hydrated it does.
  const built: { work?: WorkDocument } = {};

  const loader = createStackLoader({
    client,
    workUuid,
    spine: () => built.work?.spine,
    local,
    cache,
    buffer,
  });

  built.work = createStackWorkDocument({ workUuid, loader, spineDoc });
  return built.work;
};
