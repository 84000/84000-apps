import type {
  BodyItemType,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';

/**
 * Which of a work's three sections a passage belongs to.
 *
 * Derived from the passage type rather than stored on the row, but held in the
 * spine so a consumer can partition a work without touching a single passage
 * document.
 */
export type Matter = 'front' | 'body' | 'endnotes';

/**
 * Everything about a passage that is *not* its content.
 *
 * This is what the spine holds. It is deliberately the whole of a passage's
 * identity: a consumer can order, label, filter and render a table of contents
 * for a work of any size while holding zero passage documents in memory.
 */
export type PassageMeta = {
  uuid: string;
  label: string;
  type: BodyItemType;
  matter: Matter;
  toh?: TohokuCatalogEntry;
};

/** A passage's position and identity, as read back from the spine. */
export type SpineEntry = PassageMeta & {
  /** Zero-based position in the work. */
  index: number;
};

/**
 * A half-open range of spine positions.
 *
 * Used for hydration windows: `[start, end)`, clamped by the spine to its own
 * bounds so a caller can ask for a window around a scroll position without
 * first checking how long the work is.
 */
export type SpineRange = {
  start: number;
  end: number;
};

/**
 * The structural operations, as recorded in the command log.
 *
 * Every one of these touches the spine, and all but `reorder` touch passage
 * documents as well. Text edits are not here — they live in each passage's own
 * Yjs history and never enter this log.
 */
export type StructuralOpKind =
  | 'split'
  | 'merge'
  | 'insert'
  | 'delete'
  | 'reorder';

/**
 * Where to put the caret after an operation is undone or redone.
 *
 * The doc model has no view, so this is data rather than an action: the
 * consumer that owns editors reads it off the command and focuses accordingly.
 */
export type FocusTarget = {
  uuid: string;
  /** A ProseMirror position within the passage, or one of its ends. */
  where: 'start' | 'end' | number;
};

/** One label rewritten by renumbering, with both values. */
export type LabelChange = {
  uuid: string;
  from: string;
  to: string;
};
