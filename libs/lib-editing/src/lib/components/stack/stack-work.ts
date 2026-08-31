import { getSchema } from '@tiptap/core';
import { ySyncPluginKey } from '@tiptap/y-tiptap';
import type { Doc } from 'yjs';
import {
  WorkDocument,
  type PassageLoader,
} from '@eightyfourthousand/lib-doc-model';

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
