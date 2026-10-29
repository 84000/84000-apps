import { getSchema, type Extensions } from '@tiptap/core';
import type { GraphQLClient } from 'graphql-request';
import type { Doc } from 'yjs';
import {
  WorkDocument,
  type PassageLoader,
  type PassageSnapshot,
  type PassageSource,
  type RowOutline,
} from '@eightyfourthousand/lib-doc-model';
import type { PassageExtras } from './types';

import { createStackLoader } from './passage-source';
import { buildStackSchemaExtensions } from './stack-extensions';

export type StackWorkOptions = {
  workUuid: string;
  loader?: PassageLoader;
  /** An existing spine document, e.g. one restored from local storage. */
  spineDoc?: Doc;
  /** The schema rows are parsed with. Defaults to the passage schema. */
  extensions?: Extensions;
  /** For rows labelled by position, such as `outlineBibliographyRows`. */
  outline?: RowOutline;
};

/** Each work's text origins, which views add to. */
const textOrigins = new WeakMap<WorkDocument, Set<unknown>>();

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
 *   way — they carry the y-sync plugin's origin — so without it the passage
 *   `UndoManager` tracks nothing a typist did and Mod-Z silently skips their
 *   typing. It is a quiet failure, so it is not left to each caller: the work
 *   starts with no text origins, and a view built with the editing layer adds
 *   the editor's (`trackTextOrigin`). A reader's work never imports the y-sync
 *   plugin to name it.
 */
export const createStackWorkDocument = (options: StackWorkOptions) => {
  // One set for every passage: each undo manager tracks it by reference.
  const origins = new Set<unknown>();
  const work = new WorkDocument({
    workUuid: options.workUuid,
    schema: getSchema(options.extensions ?? buildStackSchemaExtensions()),
    loader: options.loader,
    spineDoc: options.spineDoc,
    textOrigins: origins,
    outline: options.outline,
  });
  textOrigins.set(work, origins);
  return work;
};

/**
 * Count transactions under `origin` as the user's typing in every passage of
 * a work built here, including passages hydrated later.
 *
 * A work built some other way chose its own origins, and is left alone.
 */
export const trackTextOrigin = (work: WorkDocument, origin: unknown) => {
  textOrigins.get(work)?.add(origin);
};

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
  source,
  extensions,
  outline,
  cache,
  buffer,
  spineDoc,
  extras,
}: {
  workUuid: string;
  client: GraphQLClient;
  /** `localPassageSource(storage)` from `lib-persistence`, when available. */
  local?: PassageSource;
  /** Where rows that are not passages are read from, e.g. `bibliographyRowSource`. */
  source?: PassageSource;
  /** Their schema, e.g. `buildBibliographySchemaExtensions()`. */
  extensions?: Extensions;
  /** Their outline, e.g. `outlineBibliographyRows`. */
  outline?: RowOutline;
  /** `cachePassageSnapshots(storage)` from `lib-persistence`. */
  cache?: (workUuid: string, snapshots: PassageSnapshot[]) => Promise<void>;
  /** Passages either side of the visible range to hydrate. */
  buffer?: number;
  spineDoc?: Doc;
  /** Filled with loaded passages' row data beyond their content. */
  extras?: Map<string, PassageExtras>;
}): WorkDocument => {
  // A holder rather than a reassigned binding: the loader closes over this
  // before the document exists, and by the time a window is hydrated it does.
  const built: { work?: WorkDocument } = {};

  const loader = createStackLoader({
    client,
    workUuid,
    spine: () => built.work?.spine,
    local,
    source,
    cache,
    buffer,
    extras,
  });

  built.work = createStackWorkDocument({
    workUuid,
    loader,
    spineDoc,
    extensions,
    outline,
  });
  return built.work;
};
