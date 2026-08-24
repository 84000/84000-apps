import type { JSONContent } from '@tiptap/core';
import type { Passage } from '@eightyfourthousand/data-access';
import {
  blockFromPassage,
  type FocusTarget,
  type SpineSeed,
} from '@eightyfourthousand/lib-doc-model';

/**
 * What a passage needs before its content exists: identity for the spine, the
 * content to seed its document with, and a character count.
 *
 * The count is view state, not model state — the spine deliberately holds no
 * measure of a passage's size, and a virtualized list needs one to estimate
 * row heights for passages it has not hydrated.
 */
export type StackPassageSeed = {
  meta: SpineSeed;
  content: JSONContent[];
  charCount: number;
};

/**
 * Where to put the caret, widened by the one case the doc model has no
 * opinion about: a click on a static row, which arrives as viewport
 * coordinates and is resolved against the editor once it mounts.
 */
export type StackFocusWhere = FocusTarget['where'] | { x: number; y: number };

export type StackFocusTarget = {
  uuid: string;
  where: StackFocusWhere;
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

/** Split a row into the spine's half and the view's half. */
export const stackSeedFromPassage = (passage: Passage): StackPassageSeed => {
  const block = blockFromPassage(passage);
  return {
    meta: {
      uuid: passage.uuid,
      label: passage.label,
      type: passage.type,
      toh: passage.toh,
    },
    content: (block.content ?? []) as JSONContent[],
    charCount: passage.content?.length ?? 0,
  };
};
