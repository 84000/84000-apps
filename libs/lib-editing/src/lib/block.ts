import { BlockEditorContent, BlockEditorContentItem } from '@design-system';
import { Body, BodyItemType, Passage } from '@data-access';
import { annotateBlock } from './transformers/annotate';
import type { BlockEditorContentWithParent } from './transformers';

const passageTemplate = (passage: Passage): BlockEditorContentWithParent => {
  const block: BlockEditorContentWithParent = {
    type: 'passage',
    attrs: {
      uuid: passage.uuid,
      sort: passage.sort,
      type: passage.type,
      label: passage.label,
      class: 'passage',
    },
    content: [],
  };

  const template =
    TEMPLATES_FOR_BLOCK_TYPE[passage.type] ||
    TEMPLATES_FOR_BLOCK_TYPE['translation'];
  block.content = [template(passage, block)];

  return block;
};

const textTemplate = (
  text: string,
  parent: BlockEditorContentWithParent,
): BlockEditorContentWithParent => ({
  type: 'text',
  text,
  parent,
});

const headingTemplate = (
  passage: Passage,
  parent: BlockEditorContentWithParent,
): BlockEditorContentWithParent => {
  const block: BlockEditorContentWithParent = {
    type: 'heading',
    attrs: {
      level: 1,
    },
    content: [],
    parent,
  };
  block.content = [textTemplate(passage.content, block)];
  return block;
};

const paragraphTemplate = (
  passage: Passage,
  parent: BlockEditorContentWithParent,
): BlockEditorContentWithParent => {
  const block: BlockEditorContentWithParent = {
    type: 'paragraph',
    content: [],
    parent,
  };

  block.content = [textTemplate(passage.content, block)];

  return block;
};

const TEMPLATES_FOR_BLOCK_TYPE: {
  [key in BodyItemType]: (
    passage: Passage,
    parent: BlockEditorContentWithParent,
  ) => BlockEditorContentWithParent;
} = {
  acknowledgment: paragraphTemplate,
  acknowledgmentHeader: headingTemplate,
  abbreviations: paragraphTemplate,
  abbreviationHeader: headingTemplate,
  appendix: paragraphTemplate,
  appendixHeader: headingTemplate,
  colophon: paragraphTemplate,
  colophonHeader: headingTemplate,
  endnote: paragraphTemplate,
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
  const block = passageTemplate(item);
  const templateContent = block.content?.[0] || {};

  block.content = [annotateBlock(templateContent, item.annotations)];
  return block;
};
