import { Extension, Node, type Extensions } from '@tiptap/core';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Collaboration } from '@tiptap/extension-collaboration';
import { Heading1Icon, Heading2Icon, ListPlusIcon } from 'lucide-react';
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
import { SlashCommand } from '../editor/extensions/SlashCommand/SlashCommand';
import type { CommandSuggestionItem } from '../editor/extensions/SlashCommand/SuggestionList';
import { getSuggestion } from '../editor/extensions/SlashCommand/Suggestions';
import Paragraph from '../editor/extensions/Paragraph/Paragraph';
import { SmallCaps } from '../editor/extensions/SmallCaps';
import { Subscript } from '../editor/extensions/Subscript';
import { Superscript } from '../editor/extensions/Superscript';
import { Underline } from '../editor/extensions/Underline';

import { BoundaryKeymap } from './BoundaryKeymap';
import { StackDocument } from './StackDocument';
import type {
  BibliographyOutlineDelegate,
  StackKeyboardDelegate,
} from './types';

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

/** Pastes into a heading as one line of plain text. */
const PlainTextPaste = Extension.create({
  name: 'plainTextPaste',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          transformPasted: (slice, view) => {
            const text = slice.content
              .textBetween(0, slice.content.size, ' ', ' ')
              .replace(/\s+/g, ' ');
            return text
              ? new Slice(Fragment.from(view.state.schema.text(text)), 0, 0)
              : Slice.empty;
          },
        },
      }),
    ];
  },
});

/**
 * A heading's editor schema: plain text, which is all a heading stores, so
 * nothing can be typed or pasted that the save would drop.
 */
const buildHeadingExtensions = (): Extensions => [
  StackDocument,
  Paragraph,
  Text,
  PlainTextPaste,
];

/** The slash menu's items for an entry: rows to start after it. */
const outlineSuggestions = (
  uuid: string,
  outline: BibliographyOutlineDelegate,
): CommandSuggestionItem[] => {
  const item = (
    title: string,
    description: string,
    keywords: string[],
    icon: CommandSuggestionItem['icon'],
    run: () => void,
  ): CommandSuggestionItem => ({
    title,
    description,
    keywords,
    icon,
    command: ({ editor, range }) => {
      editor.chain().deleteRange(range).run();
      run();
    },
  });
  return [
    item('Entry', 'Start a new entry.', ['entry'], ListPlusIcon, () =>
      outline.newBibliographyEntry(uuid),
    ),
    item('Heading', 'Start a heading.', ['heading'], Heading1Icon, () =>
      outline.newBibliographyHeading(uuid),
    ),
    item(
      'Subheading',
      'Start a heading under this one.',
      ['subheading', 'nested'],
      Heading2Icon,
      () => outline.newBibliographyHeading(uuid, true),
    ),
  ];
};

/**
 * A live bibliography row's editor, bound to the row's document. A heading
 * is a single line of plain text; Enter after it starts its first entry. An
 * entry splits and merges as a passage does, and its slash menu starts rows.
 */
export const buildBibliographyEditorExtensions = ({
  uuid,
  kind,
  fragment,
  undoManager,
  delegate,
  outline,
}: {
  uuid: string;
  kind: StackRowKind;
  fragment: XmlFragment;
  undoManager: UndoManager;
  delegate: StackKeyboardDelegate;
  /** Starts rows; without it, rows are edited in place. */
  outline?: BibliographyOutlineDelegate;
}): Extensions => [
  ...(kind === 'heading'
    ? buildHeadingExtensions()
    : buildBibliographySchemaExtensions()),
  ...(outline && kind === 'entry'
    ? [
        SlashCommand.configure({
          suggestion: getSuggestion(outlineSuggestions(uuid, outline)),
        }),
      ]
    : []),
  Collaboration.configure({ fragment, yUndoOptions: { undoManager } }),
  BoundaryKeymap.configure({
    uuid,
    delegate,
    restructure: !!outline,
    singleLine: kind === 'heading',
  }),
];
