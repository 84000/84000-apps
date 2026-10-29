import { Extension, type Extensions } from '@tiptap/core';
import { Fragment, Slice } from '@tiptap/pm/model';
import { Plugin } from '@tiptap/pm/state';
import { Collaboration } from '@tiptap/extension-collaboration';
import { Heading1Icon, Heading2Icon, ListPlusIcon } from 'lucide-react';
import type { StackRowKind } from '@eightyfourthousand/lib-doc-model';
import type { UndoManager, XmlFragment } from 'yjs';

import Paragraph from '../editor/extensions/Paragraph/Paragraph';
import { SlashCommand } from '../editor/extensions/SlashCommand/SlashCommand';
import type { CommandSuggestionItem } from '../editor/extensions/SlashCommand/SuggestionList';
import { getSuggestion } from '../editor/extensions/SlashCommand/Suggestions';

import { BoundaryKeymap } from './BoundaryKeymap';
import { StackDocument } from './StackDocument';
import {
  BibliographyText,
  buildBibliographySchemaExtensions,
} from './bibliography-extensions';
import type {
  BibliographyOutlineDelegate,
  StackKeyboardDelegate,
} from './types';

/*
 * The editing half of a bibliography row's extensions, apart from its schema
 * so a reader never loads the editor's plugins.
 */

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
  BibliographyText,
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
