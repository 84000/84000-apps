import type { Extensions } from '@tiptap/core';
import { Collaboration } from '@tiptap/extension-collaboration';

import { BoundaryKeymap } from './BoundaryKeymap';
import { buildGlossarySchemaExtensions } from './glossary-extensions';
import { withMentionAuthoring } from './mention-authoring';
import type { StackEditorBinding } from './types';

/**
 * A live glossary row's editor, bound to its definition's document. The
 * definition is edited in place: rows are never split, merged or started from
 * it.
 */
export const buildGlossaryEditorExtensions = ({
  uuid,
  fragment,
  undoManager,
  delegate,
}: StackEditorBinding): Extensions => [
  ...withMentionAuthoring(buildGlossarySchemaExtensions()),
  Collaboration.configure({ fragment, yUndoOptions: { undoManager } }),
  BoundaryKeymap.configure({ uuid, delegate, restructure: false }),
];
