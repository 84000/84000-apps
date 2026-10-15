import { Node, type Extensions } from '@tiptap/core';
import { Collaboration } from '@tiptap/extension-collaboration';
import type { StackRowKind } from '@eightyfourthousand/lib-doc-model';
import type { UndoManager, XmlFragment } from 'yjs';

import { Bold } from '../editor/extensions/Bold';
import { CommentMark } from '../editor/extensions/Comment/CommentMark';
import { ForeignMark } from '../editor/extensions/Foreign/Foreign';
import { GlossaryInstanceNode } from '../editor/extensions/GlossaryInstance/GlossaryInstanceNode';
import { InternalLink } from '../editor/extensions/InternalLink';
import { Italic } from '../editor/extensions/Italic';
import { Link } from '../editor/extensions/Link';
import { Mention } from '../editor/extensions/Mention/Mention';
import Paragraph from '../editor/extensions/Paragraph/Paragraph';
import { SmallCaps } from '../editor/extensions/SmallCaps';
import { Subscript } from '../editor/extensions/Subscript';
import { Superscript } from '../editor/extensions/Superscript';
import { Underline } from '../editor/extensions/Underline';

import { BoundaryKeymap } from './BoundaryKeymap';
import { StackDocument } from './StackDocument';
import type { StackKeyboardDelegate } from './types';

const Text = Node.create({ name: 'text', group: 'inline' });

/**
 * Above every link's priority, so formatting wraps a link rather than the
 * reverse. That is how stored entries nest them (`<em><a>…</a></em>`), and a
 * mark's rank is the order the serializer nests it in.
 */
const FORMATTING_PRIORITY = 1200;

/**
 * The schema for a bibliography row: paragraphs of inline content only.
 *
 * The passage set's inline marks and nodes, less what belongs to passage
 * structure (endnote links, abbreviations, trailers, line groups, mantras).
 * No `TranslationMetadata`: it mints a uuid for every parsed node and mark,
 * which stored HTML has no use for and would change on every read.
 */
export const buildBibliographySchemaExtensions = (): Extensions => [
  StackDocument,
  Paragraph,
  Text,
  Bold.extend({ priority: FORMATTING_PRIORITY }),
  CommentMark,
  ForeignMark,
  GlossaryInstanceNode,
  InternalLink,
  Italic.extend({ priority: FORMATTING_PRIORITY }),
  Link,
  Mention,
  SmallCaps.extend({ priority: FORMATTING_PRIORITY }),
  Subscript.extend({ priority: FORMATTING_PRIORITY }),
  Superscript.extend({ priority: FORMATTING_PRIORITY }),
  Underline.extend({ priority: FORMATTING_PRIORITY }),
];

/**
 * A live bibliography row's editor: the schema set, bound to the row's
 * document. Rows are edited in place, never split or merged, and a heading
 * is a single line.
 */
export const buildBibliographyEditorExtensions = ({
  uuid,
  kind,
  fragment,
  undoManager,
  delegate,
}: {
  uuid: string;
  kind: StackRowKind;
  fragment: XmlFragment;
  undoManager: UndoManager;
  delegate: StackKeyboardDelegate;
}): Extensions => [
  ...buildBibliographySchemaExtensions(),
  Collaboration.configure({ fragment, yUndoOptions: { undoManager } }),
  BoundaryKeymap.configure({
    uuid,
    delegate,
    restructure: false,
    singleLine: kind === 'heading',
  }),
];
