import { BlockEditorContent, BlockEditorContentItem } from '@design-system';
import { AnnotationType, BodyItemType, Passage } from '@data-access';
import { annotateBlock } from './transformers/annotate';

const passageTemplate = (passage: Passage): BlockEditorContentItem => {
  const block: BlockEditorContentItem = {
    type: 'passage',
    attrs: {
      uuid: passage.uuid,
      sort: passage.sort,
      type: passage.type,
      label: passage.label,
    },
    content: [],
  };

  const template =
    TEMPLATES_FOR_BLOCK_TYPE[passage.type] ||
    TEMPLATES_FOR_BLOCK_TYPE['translation'];
  block.content = [template(passage)];

  return block;
};

const textTemplate = (text: string): BlockEditorContentItem => ({
  type: 'text',
  text,
  attrs: {
    start: 0,
    end: text.length,
  },
});

const headingTemplate = (passage: Passage): BlockEditorContentItem => {
  const block: BlockEditorContentItem = {
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

const paragraphTemplate = (passage: Passage): BlockEditorContentItem => {
  const block: BlockEditorContentItem = {
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

const endNoteTemplate = (passage: Passage): BlockEditorContentItem => {
  const block: BlockEditorContentItem = {
    type: 'endNote',
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

const abbreviationTemplate = (passage: Passage): BlockEditorContentItem => {
  const content = [textTemplate(passage.content)];
  const block: BlockEditorContentItem = {
    type: 'table',
    attrs: {
      start: 0,
      end: passage.content.length,
      uuid: passage.uuid,
    },
    content: [
      {
        type: 'tableRow',
        attrs: {
          start: 0,
          end: passage.content.length,
          uuid: passage.uuid,
        },
        content: [
          {
            type: 'abbreviation',
            attrs: {
              start: 0,
              end: passage.content.length,
              uuid: passage.uuid,
            },
            content,
          },
        ],
      },
    ],
  };

  return block;
};

const TEMPLATES_FOR_BLOCK_TYPE: {
  [key in BodyItemType]: (passage: Passage) => BlockEditorContentItem;
} = {
  acknowledgment: paragraphTemplate,
  acknowledgmentHeader: headingTemplate,
  abbreviations: abbreviationTemplate,
  abbreviationHeader: headingTemplate,
  appendix: paragraphTemplate,
  appendixHeader: headingTemplate,
  colophon: paragraphTemplate,
  colophonHeader: headingTemplate,
  endnote: endNoteTemplate,
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
  toc: paragraphTemplate,
  translation: paragraphTemplate,
  translationHeader: headingTemplate,
  unknown: paragraphTemplate,
};

enum BlockPriority {
  OuterBlock = 1,
  Attribute = 2,
  Block = 3,
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
    endNoteLink: BlockPriority.Inline,
    glossaryInstance: BlockPriority.Mark,
    hasAbbreviation: BlockPriority.Inline,
    heading: BlockPriority.OuterBlock,
    indent: BlockPriority.Attribute,
    image: BlockPriority.Inline,
    inlineTitle: BlockPriority.Mark,
    internalLink: BlockPriority.Mark,
    leadingSpace: BlockPriority.Attribute,
    line: BlockPriority.Block,
    lineGroup: BlockPriority.OuterBlock,
    link: BlockPriority.Mark,
    list: BlockPriority.OuterBlock,
    listItem: BlockPriority.Block,
    mantra: BlockPriority.Inline,
    paragraph: BlockPriority.OuterBlock,
    quote: BlockPriority.Inline,
    quoted: BlockPriority.Unknown,
    reference: BlockPriority.Unknown,
    span: BlockPriority.Mark,
    tableBodyData: BlockPriority.Block,
    tableBodyHeader: BlockPriority.OuterBlock,
    tableBodyRow: BlockPriority.OuterBlock,
    trailer: BlockPriority.Attribute,
    unknown: BlockPriority.Unknown,
  };

export const blocksFromTranslationBody = (passages: Passage[]) => {
  const blocks: BlockEditorContent = [];
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

export const blockFromPassage = (passage: Passage): BlockEditorContentItem => {
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
