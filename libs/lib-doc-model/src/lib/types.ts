import type {
  BodyItemType,
  TohokuCatalogEntry,
} from '@eightyfourthousand/data-access';

/**
 * Where a passage is surfaced: which panel, and which tab within it.
 *
 * Both come from `data-access`'s `panelAndTabForContentType`, which is the
 * layout model the reader and editor already use — `PANEL_FOR_CONTENT_SECTION`
 * and `TAB_FOR_CONTENT_SECTION`, with `*Header` types folded into the section
 * they introduce.
 *
 * Tab is the useful grain, and the reason this is not a coarser three-way
 * front/body/back split: `abbreviations` and `endnotes` share the right panel
 * but are separate tabs fetched by separate queries, so any grouping that
 * cannot tell them apart makes one of them unreachable.
 *
 * Plain strings rather than a union because that is what the layout constants
 * are — `Partial<Record<PanelContentType, string>>`. Inventing a union here
 * would be a second list to keep in step with them.
 */
export type PassagePlacement = {
  /** `'main'` or `'right'` — which column shows this passage. */
  panel: string;
  /** `'front'`, `'translation'`, `'endnotes'`, `'abbreviations'`, … */
  tab: string;
};

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
  toh?: TohokuCatalogEntry;
} & PassagePlacement;

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
