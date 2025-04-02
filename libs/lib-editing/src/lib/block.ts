import { BlockEditorContent, BlockEditorContentItem } from '@design-system';
import { Annotations, Passage, Translation } from '@data-access';
import { annotateBlock } from './annotation';

const TEMPLATES_FOR_BLOCK_TYPE: {
  [key: string]: (passage: Passage) => BlockEditorContentItem;
} = {
  translation: (passage: Passage) => ({
    type: 'paragraph',
    attrs: {
      uuid: passage.uuid,
      sort: passage.sort,
      type: passage.type,
      class: 'passage',
    },
    content: [
      {
        type: 'text',
        text: passage.content,
      },
    ],
  }),
  translationHeader: (passage: Passage) => ({
    type: 'heading',
    attrs: {
      level: 3,
      uuid: passage.uuid,
      sort: passage.sort,
      type: passage.type,
      class: 'passage',
    },
    content: [
      {
        type: 'text',
        text: passage.content,
      },
    ],
  }),
};

export const bodyBlocksFromTranslation = (translation: Translation) => {
  const blocks: BlockEditorContent = [];
  translation.body.forEach((passage) => {
    if (!passage.content) {
      console.warn('passage has no content');
      console.warn(passage);
      return;
    }

    const anotations = translation.passageAnnotations.filter(
      (a) => a.passageUuid === passage.uuid,
    );
    const block = blockFromPassage(passage, anotations);

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
  item: Passage,
  annotations: Annotations = [],
): BlockEditorContentItem => {
  const template =
    TEMPLATES_FOR_BLOCK_TYPE[item.type] ||
    TEMPLATES_FOR_BLOCK_TYPE['translation'];
  const block = template(item);

  return annotateBlock(block, annotations);
};
