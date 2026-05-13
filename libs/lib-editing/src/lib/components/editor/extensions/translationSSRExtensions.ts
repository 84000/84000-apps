import type { Extensions } from '@tiptap/core';

import { Abbreviation, HasAbbreviation } from './Abbreviation/Abbreviation';
import { Audio } from './Audio/Audio';
import { Bold } from './Bold';
import { EndNoteLinkMarkSSR } from './EndNoteLink/EndNoteLinkMark.ssr';
import { GlossaryInstanceNodeSSR } from './GlossaryInstance/GlossaryInstanceNode.ssr';
import Heading from './Heading/Heading';
import Image from './Image';
import { Indent } from './Indent';
import { InternalLinkSSR } from './InternalLink/InternalLink.ssr';
import { Italic } from './Italic';
import { LeadingSpace } from './LeadingSpace';
import { LineGroupNodeSSR } from './LineGroup/LineGroupNode.ssr';
import { LineNodeSSR } from './Line/LineNode.ssr';
import { LinkSSR } from './Link/Link.ssr';
import { ListSSR, ListItemSSR } from './List.ssr';
import { MantraMark } from './Mantra/Mantra';
import { MentionSSR } from './Mention/Mention.ssr';
import Paragraph from './Paragraph/Paragraph';
import { ParagraphIndent } from './ParagraphIndent';
import { PassageNodeSSR } from './Passage/PassageNode.ssr';
import { SmallCaps } from './SmallCaps';
import { STARTER_KIT_CONFIG, StarterKit } from './StarterKit';
import { Subscript } from './Subscript';
import { Superscript } from './Superscript';
import TextAlign from './TextAlign';
import { Trailer } from './Trailer';
import { Underline } from './Underline';

export const translationSSRExtensions: Extensions = [
  Abbreviation,
  Audio,
  Bold,
  EndNoteLinkMarkSSR,
  GlossaryInstanceNodeSSR,
  HasAbbreviation,
  Heading,
  Image,
  Indent,
  InternalLinkSSR,
  Italic,
  LeadingSpace,
  LineGroupNodeSSR,
  LineNodeSSR,
  LinkSSR,
  ListSSR,
  ListItemSSR,
  MantraMark,
  MentionSSR,
  Paragraph,
  ParagraphIndent,
  PassageNodeSSR,
  SmallCaps,
  StarterKit.configure({
    ...STARTER_KIT_CONFIG,
    trailingNode: { notAfter: ['passage', 'paragraph'] },
    undoRedo: false,
  }),
  Subscript,
  Superscript,
  TextAlign,
  Trailer,
  Underline,
];
