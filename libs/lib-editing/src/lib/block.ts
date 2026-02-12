import type {
  Alignment,
  AnnotationType,
  BodyItemType,
  Passage,
  TranslationEditorContentItem,
  TranslationEditorContent,
} from '@data-access';
import { annotateBlock } from './transformers/annotate';

const passageTemplate = (passage: Passage): TranslationEditorContentItem => {
  const alignments: { [key: string]: Alignment } =
    passage.alignments?.reduce(
      (acc, alignment) => {
        acc[alignment.toh] = alignment;
        return acc;
      },
      {} as { [key: string]: Alignment },
    ) || {};
  const block: TranslationEditorContentItem = {
    type: 'passage',
    attrs: {
      uuid: passage.uuid,
      sort: passage.sort,
      type: passage.type,
      label: passage.label,
      toh: passage.toh,
      alignments,
    },
    content: [],
  };

  const template =
    TEMPLATES_FOR_BLOCK_TYPE[passage.type] ||
    TEMPLATES_FOR_BLOCK_TYPE['translation'];
  block.content = [template(passage)];

  return block;
};

const textTemplate = (text: string): TranslationEditorContentItem => ({
  type: 'text',
  text,
  attrs: {
    start: 0,
    end: text.length,
  },
});

const headingTemplate = (passage: Passage): TranslationEditorContentItem => {
  const block: TranslationEditorContentItem = {
    type: 'heading',
    attrs: {
      level: 1,
      start: 0,
      end: passage.content.length,
      uuid: passage.uuid,
    },
    content: [],
  };
  block.content = [textTemplate(passage.content)];
  return block;
};

const paragraphTemplate = (passage: Passage): TranslationEditorContentItem => {
  const block: TranslationEditorContentItem = {
    type: 'paragraph',
    attrs: {
      start: 0,
      end: passage.content.length,
      uuid: passage.uuid,
    },
    content: [],
  };

  block.content = [textTemplate(passage.content)];
  return block;
};

const abbreviationTemplate = (
  passage: Passage,
): TranslationEditorContentItem => {
  const block: TranslationEditorContentItem = {
    type: 'paragraph',
    attrs: {
      class: 'flex flex-row gap-2',
      start: 0,
      end: passage.content.length,
      uuid: passage.uuid,
    },
    content: [],
  };

  block.content = [textTemplate(passage.content)];
  return block;
};

const TEMPLATES_FOR_BLOCK_TYPE: {
  [key in BodyItemType]: (passage: Passage) => TranslationEditorContentItem;
} = {
  acknowledgment: paragraphTemplate,
  acknowledgmentHeader: headingTemplate,
  abbreviations: abbreviationTemplate,
  abbreviationsHeader: headingTemplate,
  appendix: paragraphTemplate,
  appendixHeader: headingTemplate,
  colophon: paragraphTemplate,
  colophonHeader: headingTemplate,
  endnotes: paragraphTemplate,
  endnotesHeader: headingTemplate,
  homage: paragraphTemplate,
  homageHeader: headingTemplate,
  introduction: paragraphTemplate,
  introductionHeader: headingTemplate,
  prelude: paragraphTemplate,
  preludeHeader: headingTemplate,
  prologue: paragraphTemplate,
  prologueHeader: headingTemplate,
  summary: paragraphTemplate,
  summaryHeader: headingTemplate,
  translation: paragraphTemplate,
  translationHeader: headingTemplate,
  unknown: paragraphTemplate,
};

enum BlockPriority {
  OuterBlock = 0,
  ParentBlock = 1,
  Block = 2,
  Attribute = 3,
  Inline = 4,
  Mark = 5,
  Unknown = Number.MIN_SAFE_INTEGER,
}

const PRIORITY_FOR_ANNOTAION_TYPE: { [key in AnnotationType]: BlockPriority } =
  {
    abbreviation: BlockPriority.Inline,
    audio: BlockPriority.Inline,
    blockquote: BlockPriority.OuterBlock,
    code: BlockPriority.Inline,
    deprecated: BlockPriority.Unknown,
    endNoteLink: BlockPriority.Mark,
    glossaryInstance: BlockPriority.Mark,
    hasAbbreviation: BlockPriority.Inline,
    heading: BlockPriority.OuterBlock,
    indent: BlockPriority.Attribute,
    image: BlockPriority.Inline,
    inlineTitle: BlockPriority.Mark,
    internalLink: BlockPriority.Mark,
    leadingSpace: BlockPriority.Attribute,
    line: BlockPriority.Block,
    lineGroup: BlockPriority.ParentBlock,
    link: BlockPriority.Mark,
    list: BlockPriority.ParentBlock,
    listItem: BlockPriority.Block,
    mantra: BlockPriority.Mark,
    paragraph: BlockPriority.OuterBlock,
    quote: BlockPriority.Inline,
    quoted: BlockPriority.Unknown,
    reference: BlockPriority.Unknown,
    span: BlockPriority.Mark,
    table: BlockPriority.OuterBlock,
    tableBodyData: BlockPriority.Block,
    tableBodyHeader: BlockPriority.ParentBlock,
    tableBodyRow: BlockPriority.ParentBlock,
    trailer: BlockPriority.OuterBlock,
    unknown: BlockPriority.Unknown,
  };

export const blocksFromTranslationBody = (
  passages: Passage[],
): TranslationEditorContent => {
  const blocks: TranslationEditorContent = [];
  passages.forEach((passage) => {
    if (!passage.content) {
      console.warn('passage has no content');
      console.warn(passage);
      return;
    }

    const block = blockFromPassage(passage);

    if (!block) {
      console.warn('unknown block type');
      console.warn(passage);
      return;
    }

    blocks.push(block);
  });

  return blocks;
};

export const blockFromPassage = (
  passage: Passage,
): TranslationEditorContentItem => {
  const block = passageTemplate(passage);

  // Sort annotations by start position, then by end position in descending
  // order to ensure that the longest annotations are processed first. If two
  // annotations have the same start and end positions, sort by processing
  // priority.
  passage.annotations?.sort((a, b) => {
    if (a.start !== b.start) {
      return a.start - b.start;
    }

    if (a.end !== b.end) {
      return b.end - a.end;
    }

    const aPriority =
      PRIORITY_FOR_ANNOTAION_TYPE[a.type] || BlockPriority.Unknown;
    const bPriority =
      PRIORITY_FOR_ANNOTAION_TYPE[b.type] || BlockPriority.Unknown;
    return aPriority - bPriority;
  });

  annotateBlock(block, passage.annotations);

  return block;
};
