import type { Editor, Extensions, JSONContent } from '@tiptap/core';
import type { ComponentType } from 'react';
import type { UndoManager, XmlFragment } from 'yjs';
import type { Passage } from '@eightyfourthousand/data-access';
import type { PassageReference } from '../editor/extensions/Passage/PassageNode.ssr';
import type { BeyondPage } from './spine-feed';
import type { StackController } from './StackController';
import type { StackPassageMenuTarget } from './StackPassageMenu';
import {
  blockFromPassage,
  type FocusTarget,
  type PassageMeta,
  type SpineSeed,
  type StackRowKind,
  type WorkDocument,
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

/**
 * A run of whole passages, as the two ends the reader dragged between.
 *
 * Stored as anchor and focus rather than as an ordered range so the direction
 * of the drag survives; spine order decides which is first.
 */
export type StackPassageSelection = {
  anchorUuid: string;
  focusUuid: string;
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
  /**
   * Split a passage at the caret, or at `at` — a position in the passage's
   * own document — when the caller has worked out a better place to cut.
   */
  splitAtSelection: (uuid: string, at?: number) => boolean;
  mergeWithPrevious: (uuid: string) => boolean;
  undo: () => boolean;
  redo: () => boolean;
};

/** What a bibliography row's editor starts rows through. */
export type BibliographyOutlineDelegate = {
  newBibliographyEntry: (uuid: string) => boolean;
  newBibliographyHeading: (uuid: string, nested?: boolean) => boolean;
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
      sort: passage.sort,
    },
    content: (block.content ?? []) as JSONContent[],
    charCount: passage.content?.length ?? 0,
  };
};

/**
 * Row data a passage's document doesn't hold: the passages referring to it,
 * and its Tibetan source for each Toh it is aligned to.
 */
export type PassageExtras = {
  references?: PassageReference[];
  alignments?: Record<string, { tibetan?: string }>;
};

/**
 * Grows the spine as the reader approaches an end of it.
 *
 * What the controller asks of a feed, whatever entity its rows come from.
 */
export type StackRowFeed = {
  hasMore: boolean;
  maybeExtend: (visibleEnd: number) => boolean;
  /** The page `maybeExtend` started, shared rather than fetched again. */
  extend?: () => Promise<number>;
  /** Characters of text in a passage, for estimating an unhydrated row. */
  contentLength?: (uuid: string) => number | undefined;
  /** Only a feed that can read backward supplies these. */
  hasMoreBefore?: boolean;
  maybeExtendBefore?: (visibleStart: number) => boolean;
  /** The page `maybeExtendBefore` started, shared rather than fetched again. */
  extendBefore?: () => Promise<number>;
  reveal?: (uuid: string) => Promise<number>;
  revealStart?: () => Promise<void>;
  /** Content past an end of the run, without moving it; null on failure. */
  readBeyond?: (
    direction: 'before' | 'after',
    cursor: string,
  ) => Promise<BeyondPage | null>;
};

export type PassageStackControllerOptions = {
  work: WorkDocument;
  /** Character counts by passage uuid, for estimating unhydrated row heights. */
  charCounts?: Iterable<readonly [string, number]>;
  /**
   * Grows the spine as the reader approaches the end of it.
   *
   * Optional: a caller holding a complete spine already — the scale harness,
   * and tests — passes none, and the stack simply never asks for more.
   */
  spineFeed?: StackRowFeed;
  /**
   * Reader rather than studio. No row ever mounts an editor, nothing edits the
   * work, and bookmarks show, as `TranslationReader` does. Can be changed
   * later with `setReadOnly`.
   */
  readOnly?: boolean;
  /**
   * Names this view's hydration window on the work.
   *
   * Views over one work scroll independently, and the work hydrates the union
   * of their windows — so two controllers sharing a key would release each
   * other's documents, which is the whole thing the key prevents.
   */
  windowKey?: string;
  /**
   * Draw only this tab's passages.
   *
   * One work, one spine, one undo history — but a view per panel, because
   * that is what the editor draws. Omitted, the view is the whole spine.
   */
  tab?: string;
  /** Loaded passages' row data beyond their content, as the loader records it. */
  extras?: ReadonlyMap<string, PassageExtras>;
  /**
   * What the rows are. Bibliography rows are edited in place: they are
   * never split, merged or deleted here. Defaults to passages.
   */
  rows?: StackRows;
};

/** What a live row's editor is bound to. */
export type StackEditorBinding = {
  uuid: string;
  fragment: XmlFragment;
  undoManager: UndoManager;
  delegate: StackKeyboardDelegate;
};

/** A live row's editor, as `PassageStack` draws one. */
export type StackPassageEditorProps = {
  controller: StackController;
  meta: PassageMeta;
  focused: boolean;
  selected?: boolean;
  /** The Tibetan source, in Compare; undefined outside it. */
  tibetan?: string;
  /** The Compare column's top margin, from the passage's first block. */
  tibetanLead?: string;
};

/** The editing controls `PassageStack` draws once for a whole stack. */
export type StackEditingMenusProps = {
  controller: StackController;
  /** The focused row's editor, when this copy of the stack holds it. */
  editor: Editor | null;
  /** The row whose label menu is open. */
  target: StackPassageMenuTarget | null;
  onClose: () => void;
};

/**
 * Everything a stack needs to edit, and a reader does not.
 *
 * A view is handed this rather than importing it so that a reader's module
 * graph holds no editor: no live-editor component, no menus, and no
 * collaboration or y-sync plugin. `PassageStackController` supplies it;
 * `StackController` alone is read-only.
 */
export type StackEditing = {
  /**
   * The transaction origin a live editor writes under, which the passage
   * undo managers track as the user's typing.
   */
  textOrigin: unknown;
  passageExtensions: (binding: StackEditorBinding) => Extensions;
  bibliographyExtensions: (
    binding: StackEditorBinding & {
      kind: StackRowKind;
      /** Starts rows; without it, rows are edited in place. */
      outline?: BibliographyOutlineDelegate;
    },
  ) => Extensions;
  PassageEditor: ComponentType<StackPassageEditorProps>;
  Menus: ComponentType<StackEditingMenusProps>;
};

/** A view with, or without, the means to edit. */
export type StackControllerOptions = PassageStackControllerOptions & {
  /** Without it, the view is read-only whatever `readOnly` says. */
  editing?: StackEditing;
};

/** The entity a stack's rows are. */
export type StackRows = 'passages' | 'bibliography';

/**
 * Scrolls one drawn copy of a stack view to a row. `settle` holds the row in
 * place while the rows around it load and take their real heights.
 */
export type StackScrollHandler = (
  index: number,
  options?: { settle?: boolean },
) => void;
