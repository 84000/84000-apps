import { Extensions } from '@tiptap/core';

import {
  STARTER_KIT_CONFIG,
  StarterKit,
} from '../editor/extensions/StarterKit';
import TranslationMetadata from '../editor/extensions/TranslationMetadata';
import { AnnotationToh } from '../editor/extensions/AnnotationToh';
import { Audio } from '../editor/extensions/Audio/Audio';
import {
  Abbreviation,
  HasAbbreviation,
} from '../editor/extensions/Abbreviation/Abbreviation';
import { Bold } from '../editor/extensions/Bold';
import { CommentMark } from '../editor/extensions/Comment/CommentMark';
import { EndNoteLinkMark } from '../editor/extensions/EndNoteLink/EndNoteLinkMark';
import { EnsureUniqueUuids } from '../editor/extensions/EnsureUniqueUuids';
import { ForeignMark } from '../editor/extensions/Foreign/Foreign';
import { GlossaryInstanceNode } from '../editor/extensions/GlossaryInstance/GlossaryInstanceNode';
import Heading from '../editor/extensions/Heading/Heading';
import Image from '../editor/extensions/Image';
import { Indent } from '../editor/extensions/Indent';
import { InlineTitleMark } from '../editor/extensions/InlineTitle/InlineTitle';
import { InternalLink } from '../editor/extensions/InternalLink';
import { Italic } from '../editor/extensions/Italic';
import { LeadingSpace } from '../editor/extensions/LeadingSpace';
import { LineGroupNode } from '../editor/extensions/LineGroup/LineGroupNode';
import { LineNode } from '../editor/extensions/Line/LineNode';
import { Link } from '../editor/extensions/Link';
import { List, ListItem } from '../editor/extensions/List';
import { MantraMark } from '../editor/extensions/Mantra/Mantra';
import { Mention } from '../editor/extensions/Mention/Mention';
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

/**
 * The schema half of the stack's extension set.
 */
export const buildStackSchemaExtensions = (): Extensions => [
  StackDocument,
  Audio,
  Abbreviation,
  AnnotationToh,
  HasAbbreviation,
  Bold,
  CommentMark,
  EndNoteLinkMark,
  EnsureUniqueUuids,
  ForeignMark,
  GlossaryInstanceNode,
  Heading,
  Image,
  Indent,
  InlineTitleMark,
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
  Placeholder,
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
    trailingNode: false,
    undoRedo: false,
  }),
];
