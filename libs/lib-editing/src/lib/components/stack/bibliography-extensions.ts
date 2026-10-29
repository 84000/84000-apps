import { Node, type Extensions } from '@tiptap/core';

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

import { StackDocument } from './StackDocument';

/** Inline text, the only kind a bibliography row holds. */
export const BibliographyText = Node.create({ name: 'text', group: 'inline' });

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
  BibliographyText,
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
