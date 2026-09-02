import { Extensions } from '@tiptap/core';
import { TableOfContentsIcon } from 'lucide-react';
import { Collaboration } from '@tiptap/extension-collaboration';
import type { UndoManager, XmlFragment } from 'yjs';

import {
  STARTER_KIT_CONFIG,
  StarterKit,
} from '../editor/extensions/StarterKit';
import TranslationMetadata from '../editor/extensions/TranslationMetadata';
import { AnnotationToh } from '../editor/extensions/AnnotationToh';
import { Audio } from '../editor/extensions/Audio/Audio';
import {
  Abbreviation,
  AbbreviationCommand,
  AbbreviationSuggestion,
  HasAbbreviation,
} from '../editor/extensions/Abbreviation/Abbreviation';
import { Bold } from '../editor/extensions/Bold';
import { EndNoteLinkMark } from '../editor/extensions/EndNoteLink/EndNoteLinkMark';
import { EnsureUniqueUuids } from '../editor/extensions/EnsureUniqueUuids';
import { ForeignMark } from '../editor/extensions/Foreign/Foreign';
import { GlossaryInstanceNode } from '../editor/extensions/GlossaryInstance/GlossaryInstanceNode';
import Heading from '../editor/extensions/Heading/Heading';
import Image from '../editor/extensions/Image';
import { Indent } from '../editor/extensions/Indent';
import { InternalLink } from '../editor/extensions/InternalLink';
import { Italic } from '../editor/extensions/Italic';
import { LeadingSpace } from '../editor/extensions/LeadingSpace';
import { LineGroupNode } from '../editor/extensions/LineGroup/LineGroupNode';
import { LineNode } from '../editor/extensions/Line/LineNode';
import { Link } from '../editor/extensions/Link';
import { List, ListItem } from '../editor/extensions/List';
import { MantraMark } from '../editor/extensions/Mantra/Mantra';
import { Mention } from '../editor/extensions/Mention/Mention';
import { MentionCommandSuggestion } from '../editor/extensions/Mention/MentionCommandSuggestion';
import { SlashCommand } from '../editor/extensions/SlashCommand/SlashCommand';
import {
  BulletListSuggestion,
  Heading1Suggestion,
  Heading2Suggestion,
  Heading3Suggestion,
  NumberListSuggestion,
  QuoteSuggestion,
  TextSuggestion,
  getSuggestion,
} from '../editor/extensions/SlashCommand/Suggestions';
import type { CommandSuggestionItem } from '../editor/extensions/SlashCommand/SuggestionList';
import Paragraph from '../editor/extensions/Paragraph/Paragraph';
import { ParagraphIndent } from '../editor/extensions/ParagraphIndent';
import { PipeNotItalic } from '../editor/extensions/PipeNotItalic';
import Placeholder from '../editor/extensions/Placeholder';
import { SmallCaps } from '../editor/extensions/SmallCaps';
import { Subscript } from '../editor/extensions/Subscript';
import { Superscript } from '../editor/extensions/Superscript';
import { TableKit } from '../editor/extensions/Table';
import TextAlign from '../editor/extensions/TextAlign';
import { Trailer } from '../editor/extensions/Trailer';
import { Typography } from '../editor/extensions/Typography';
import { Underline } from '../editor/extensions/Underline';
import WordBreak from '../editor/extensions/WordBreak';

import { StackDocument } from './StackDocument';
import { BoundaryKeymap } from './BoundaryKeymap';
import type { StackKeyboardDelegate } from './types';

/**
 * The schema half of the stack's extension set.
 *
 * The translation set minus everything that assumes one document per panel:
 * no `TranslationDocument`/`PassageNode`, because passage identity lives in the
 * spine rather than in a wrapping node, and no undo history — the stack routes
 * undo through its command log.
 *
 * *Schema* is the operative word: this list is what `getSchema` builds the
 * ProseMirror schema from, so it also governs how `PassageDoc` parses content
 * and how the static row tier renders it. Only extensions contributing nodes,
 * marks or attributes belong here; commands and plugins go in the editor set
 * below, where they cannot change how a document is parsed.
 *
 * `AnnotationToh` is here rather than there because it declares attributes. It
 * is not needed to *carry* a toh scope — `TranslationMetadata` already declares
 * `toh` on every type — but it is what renders `data-toh`, which is the
 * attribute the reader's toh-visibility rule reads. Without it the static tier
 * emits `toh=` and a passage scoped to an inactive Tohoku text cannot be
 * hidden.
 */
export const buildStackSchemaExtensions = (): Extensions => [
  StackDocument,
  Audio,
  Abbreviation,
  AnnotationToh,
  HasAbbreviation,
  Bold,
  EndNoteLinkMark,
  EnsureUniqueUuids,
  ForeignMark,
  GlossaryInstanceNode,
  Heading,
  Image,
  Indent,
  InternalLink,
  Italic,
  LeadingSpace,
  LineGroupNode,
  LineNode,
  Link,
  List,
  ListItem,
  MantraMark,
  Mention,
  Paragraph,
  ParagraphIndent,
  PipeNotItalic,
  Placeholder.configure({ placeholder: 'Empty passage' }),
  SmallCaps,
  Subscript,
  Superscript,
  TableKit,
  Trailer,
  TranslationMetadata,
  TextAlign,
  Typography,
  Underline,
  WordBreak,
  StarterKit.configure({
    ...STARTER_KIT_CONFIG,
    // No trailing node: it exists only in live editors, so it would make a
    // passage grow on focus and shift the rows below it. Gap cursor still
    // allows insertion after a trailing table or line group.
    trailingNode: false,
    undoRedo: false,
  }),
];

/**
 * The stack's replacement for the production "Passage" slash item.
 *
 * Production runs `splitPassage().normalizeLabelsAfter()`, both commands of the
 * `PassageNode` this model does not have. The split is a spine operation here,
 * so it goes through the controller and renumbering follows from the spine.
 *
 * One deliberate difference: production also does
 * `selectParentNode().deleteCurrentNode()` to drop the block the trigger was
 * typed into. A single-passage document's top node is `block+`, so deleting its
 * only block would leave it invalid; the split puts that block in the tail
 * instead, which is where the caret was going anyway.
 */
const passageSuggestionFor = (
  uuid: string,
  delegate: StackKeyboardDelegate,
): CommandSuggestionItem => ({
  title: 'Passage',
  description: 'Start a new passage.',
  keywords: ['passage'],
  icon: TableOfContentsIcon,
  command: ({ editor, range }) => {
    editor.chain().deleteRange(range).run();
    delegate.splitAtSelection(uuid);
  },
});

export const buildStackEditorExtensions = ({
  uuid,
  fragment,
  undoManager,
  delegate,
}: {
  uuid: string;
  fragment: XmlFragment;
  undoManager: UndoManager;
  delegate: StackKeyboardDelegate;
}): Extensions => [
  ...buildStackSchemaExtensions(),
  // Commands and plugins, kept out of the schema set so they cannot affect how
  // a passage document is parsed or statically rendered.
  AbbreviationCommand,
  SlashCommand.configure({
    suggestion: getSuggestion([
      TextSuggestion,
      passageSuggestionFor(uuid, delegate),
      Heading1Suggestion,
      Heading2Suggestion,
      Heading3Suggestion,
      AbbreviationSuggestion,
      MentionCommandSuggestion,
      BulletListSuggestion,
      NumberListSuggestion,
      QuoteSuggestion,
    ]),
  }),
  // The controller's persistent per-passage UndoManager is handed to the
  // undo plugin so history accumulates across mounts (its destroy is
  // neutered — the plugin destroys whatever manager it is given).
  Collaboration.configure({ fragment, yUndoOptions: { undoManager } }),
  BoundaryKeymap.configure({ uuid, delegate }),
];
