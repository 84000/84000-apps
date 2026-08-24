/**
 * `@eightyfourthousand/lib-doc-model`
 *
 * The per-passage document model: one small Yjs document per passage, a
 * work-level spine holding order and identity, structural operations over the
 * two, and the exporters that turn a passage document back into a row.
 *
 * Nothing here touches a browser API, and nothing here imports an editor. That
 * is the constraint the package exists to hold: the same model backs the
 * browser editor stack, `@eightyfourthousand/lib-persistence` (which depends on
 * this package, not the other way round), and the server-side write path in
 * Next.js route handlers.
 *
 * See `README.md` for the shape of the model and why it is sharded.
 */

export { blockFromPassage, blocksFromTranslationBody } from './lib/block';

export { CommandLog } from './lib/command-log';
export type {
  Command,
  ContentChange,
  MoveChange,
  SpineChange,
  StructuralCommand,
  TextCommand,
} from './lib/command-log';

export { PassageDocStore, windowUuids } from './lib/doc-store';
export type { PassageDocStoreOptions } from './lib/doc-store';

export {
  decrementLabel,
  incrementLabel,
  renumberLabelsFrom,
} from './lib/labels';

export { PassageLoader } from './lib/loader';
export type {
  LoadReport,
  PassageLoaderOptions,
  PassageSnapshot,
  PassageSource,
} from './lib/loader';

export { matterForType } from './lib/matter';

export {
  PassageDoc,
  REMOTE_ORIGIN,
  STRUCTURAL_ORIGIN,
} from './lib/passage-doc';
export type { PassageDocOptions } from './lib/passage-doc';

export { passageFromNode } from './lib/passage';

export { Spine, SPINE_ORIGIN } from './lib/spine';
export type { MutateOptions } from './lib/spine';

export { WorkDocument } from './lib/work-document';
export type {
  InsertPassageInput,
  WorkDocumentOptions,
} from './lib/work-document';

export type {
  FocusTarget,
  LabelChange,
  Matter,
  PassageMeta,
  SpineEntry,
  SpineRange,
  StructuralOpKind,
} from './lib/types';

export { MARK_TYPES } from './lib/mark-types';
export type { SpanMarkType } from './lib/mark-types';

export * from './lib/exporters';
