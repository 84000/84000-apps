import { BlockEditorContent, BlockEditorContentItem } from '@design-system';
import { Body, BodyItemType, Passage } from '@data-access';
import { annotateBlock } from './transformers/annotate';

const headingTemplate = (passage: Passage) => ({
  type: 'passage',
  attrs: {
    uuid: passage.uuid,
    sort: passage.sort,
    type: passage.type,
    label: passage.label,
    class: 'passage',
  },
  content: [
    {
      type: 'heading',
      attrs: {
        level: 1,
      },
      content: [
        {
          type: 'text',
          text: passage.content,
        },
      ],
    },
  ],
});

const paragraphTemplate = (passage: Passage) => ({
  type: 'passage',
  attrs: {
    uuid: passage.uuid,
    sort: passage.sort,
    type: passage.type,
    label: passage.label,
    class: 'passage',
  },
  content: [
    {
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: passage.content,
        },
      ],
    },
  ],
});

const TEMPLATES_FOR_BLOCK_TYPE: {
  [key in BodyItemType]: (passage: Passage) => BlockEditorContentItem;
} = {
  acknowledgment: paragraphTemplate,
  acknowledgmentHeader: paragraphTemplate,
  abbreviations: paragraphTemplate,
  abbreviationHeader: paragraphTemplate,
  appendix: paragraphTemplate,
  appendixHeader: paragraphTemplate,
  colophon: paragraphTemplate,
  colophonHeader: paragraphTemplate,
  endnotesHeader: paragraphTemplate,
  endnote: paragraphTemplate,
  homage: paragraphTemplate,
  homageHeader: paragraphTemplate,
  introduction: paragraphTemplate,
  introductionHeader: paragraphTemplate,
  prelude: paragraphTemplate,
  preludeHeader: paragraphTemplate,
  prologue: paragraphTemplate,
  prologueHeader: paragraphTemplate,
  summary: paragraphTemplate,
  summaryHeader: paragraphTemplate,
  translation: paragraphTemplate,
  translationHeader: headingTemplate,
  unknown: paragraphTemplate,
};

export const blocksFromTranslationBody = (body: Body) => {
  const blocks: BlockEditorContent = [];
  body.forEach((passage) => {
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

export const blockFromPassage = (item: Passage): BlockEditorContentItem => {
  const template =
    TEMPLATES_FOR_BLOCK_TYPE[item.type] ||
    TEMPLATES_FOR_BLOCK_TYPE['translation'];
  const block = template(item);
  const templateContent = block.content?.[0] || {};

  block.content = [annotateBlock(templateContent, item.annotations)];
  return block;
};
