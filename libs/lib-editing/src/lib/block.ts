import { BlockEditorContent, BlockEditorContentItem } from '@design-system';
import { Body, BodyItemType, Passage } from '@data-access';
import { annotateBlock } from './annotation';

const passageTemplate = (passage: Passage) => ({
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
      type: 'text',
      text: passage.content,
    },
  ],
});

const TEMPLATES_FOR_BLOCK_TYPE: {
  [key in BodyItemType]: (passage: Passage) => BlockEditorContentItem;
} = {
  acknowledgment: passageTemplate,
  acknowledgmentHeader: passageTemplate,
  abbreviations: passageTemplate,
  abbreviationHeader: passageTemplate,
  appendix: passageTemplate,
  appendixHeader: passageTemplate,
  colophon: passageTemplate,
  colophonHeader: passageTemplate,
  endNotesHeader: passageTemplate,
  'end-note': passageTemplate,
  homage: passageTemplate,
  homageHeader: passageTemplate,
  introduction: passageTemplate,
  introductionHeader: passageTemplate,
  prelude: passageTemplate,
  preludeHeader: passageTemplate,
  prologue: passageTemplate,
  prologueHeader: passageTemplate,
  summary: passageTemplate,
  summaryHeader: passageTemplate,
  translation: passageTemplate,
  translationHeader: passageTemplate,
  unknown: passageTemplate,
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

  return annotateBlock(block, item.annotations);
};
