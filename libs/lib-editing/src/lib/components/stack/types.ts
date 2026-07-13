import type {
  BodyItemType,
  Passage,
  TranslationEditorContentItem,
} from '@eightyfourthousand/data-access';
import { blockFromPassage } from '../../block';

export type StackPassageMeta = {
  uuid: string;
  label: string;
  sort: number;
  type: BodyItemType;
  toh?: string;
};

export type StackPassageSeed = {
  meta: StackPassageMeta;
  content: TranslationEditorContentItem[];
  charCount: number;
};

export type StackFocusTarget = {
  uuid: string;
  where: 'start' | 'end' | number;
};

export type StackCrossSelection = {
  fromUuid: string;
  fromPos: number;
  toUuid: string;
  toPos: number;
};

/**
 * The subset of the stack controller the per-editor keymap needs, kept as an
 * interface so the extension module doesn't depend on the controller class.
 */
export type StackKeyboardDelegate = {
  focusRelative: (
    uuid: string,
    direction: -1 | 1,
    where: 'start' | 'end',
  ) => boolean;
  splitAtSelection: (uuid: string) => boolean;
  mergeWithPrevious: (uuid: string) => boolean;
  undo: () => boolean;
  redo: () => boolean;
};

export const stackSeedFromPassage = (passage: Passage): StackPassageSeed => {
  const block = blockFromPassage(passage);
  return {
    meta: {
      uuid: passage.uuid,
      label: passage.label,
      sort: passage.sort,
      type: passage.type,
      toh: passage.toh,
    },
    content: (block.content ?? []) as TranslationEditorContentItem[],
    charCount: passage.content?.length ?? 0,
  };
};
