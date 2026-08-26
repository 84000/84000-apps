import {
  Annotation,
  AnnotationType,
  TohokuCatalogEntry,
  parseTohList,
  serializeTohList,
} from '@eightyfourthousand/data-access';
import type { TranslationEditorContentType } from './transformers/transformer';

/**
 * The document-level plumbing shared by every annotation: the `toh` scope each
 * one may carry, and the two "parameter" annotations that live as attributes on
 * a host block rather than as a node or mark of their own.
 *
 * Both used to be spread across parallel lists in four packages — a `hasX` flag,
 * an `xUuid` attribute, and a per-type name in each list that had to be kept in
 * sync by hand. They are one registry here so a new parameter annotation, or a
 * new annotation-bearing type, is declared once.
 */

/** Node/mark attribute holding an annotation's toh scope, in DB string form. */
export const TOH_ATTR = 'toh';

/**
 * Every node and mark type that maps to an annotation, and so must be able to
 * carry a `toh` scope through the editor round trip.
 *
 * `toh` is declared on `AnnotationBase`, so *any* annotation may be scoped to a
 * subset of a work's Tohoku texts — production carries a scope on 18 distinct
 * annotation types. The editor drops any attribute a node or mark does not
 * declare (ProseMirror's `computeAttrs` iterates the spec, not the supplied
 * value), so a type missing from this list silently loses its scope on save.
 *
 * `text` and `doc` are deliberately absent: neither maps to an annotation, and
 * ProseMirror text nodes cannot carry attributes.
 */
export const ANNOTATION_TOH_TYPES = [
  // block nodes
  'blockquote',
  'bulletList',
  'heading',
  'line',
  'lineGroup',
  'listItem',
  'paragraph',
  'table',
  'tableCell',
  'tableHeader',
  'tableRow',
  'trailer',
  // inline nodes
  'audio',
  'image',
  'mention',
  // marks
  'abbreviation',
  'bold',
  'code',
  'endNoteLink',
  'foreign',
  'glossaryInstance',
  'hasAbbreviation',
  'internalLink',
  'italic',
  'link',
  'mantra',
  'smallCaps',
  'subscript',
  'superscript',
  'underline',
] as const;

/**
 * A parameter annotation: one that has no node or mark of its own and is
 * recorded as an attribute on whichever block hosts it.
 *
 * The attribute is object-valued — `{ uuid, toh }` or absent — so an
 * annotation's presence, identity and scope are one value that moves together.
 * The previous flat `hasIndent` / `indentUuid` pair could be split by any code
 * path that copied one and not the other.
 */
export type ParameterAnnotationValue = {
  uuid: string;
  /** DB string form ("toh417,toh418"), absent when the annotation is unscoped. */
  toh?: string;
};

export type ParameterAnnotationSpec = {
  /** The node attribute the value is stored under. */
  attr: string;
  /** The annotation type it exports as. */
  type: AnnotationType;
  /** Block types that may host it. */
  hostTypes: TranslationEditorContentType[];
};

export const PARAMETER_ANNOTATIONS: ParameterAnnotationSpec[] = [
  {
    attr: 'indent',
    type: 'indent',
    // `bulletList`, not `list`: the list node is tiptap's `BulletList`
    // extended, and the previous spelling named no node at all, so an indent
    // on a list was never declared and never survived a save.
    hostTypes: ['paragraph', 'lineGroup', 'bulletList', 'blockquote'],
  },
  {
    attr: 'leadingSpace',
    type: 'leadingSpace',
    hostTypes: ['blockquote', 'heading', 'lineGroup', 'paragraph'],
  },
];

export const PARAMETER_ANNOTATION_ATTRS = PARAMETER_ANNOTATIONS.map(
  (spec) => spec.attr,
);

/**
 * Attributes that carry annotation identity rather than content, and so must
 * not be copied onto a block split off from another (they would duplicate an
 * annotation uuid onto two nodes).
 */
export const IDENTITY_ATTRS = ['uuid', ...PARAMETER_ANNOTATION_ATTRS];

/** Reads a parameter annotation off a node's attributes, if present. */
export const parameterAnnotationValue = (
  attrs: Record<string, unknown> | undefined,
  attr: string,
): ParameterAnnotationValue | undefined => {
  const value = attrs?.[attr];
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const { uuid, toh } = value as Partial<ParameterAnnotationValue>;
  return uuid ? { uuid, ...(toh ? { toh } : {}) } : undefined;
};

/** The toh scope stored on a node or mark, parsed into catalogue entries. */
export const tohFromAttrs = (
  attrs: Record<string, unknown> | undefined,
): TohokuCatalogEntry[] => parseTohList(attrs?.[TOH_ATTR] as string | undefined);

/**
 * The `toh` attribute fragment for a node or mark built from `annotation`.
 *
 * Spread into the attrs a transformer constructs. Empty for an unscoped
 * annotation so the attribute stays absent rather than holding `undefined`.
 */
export const tohAttrs = (
  annotation: Pick<Annotation, 'toh'>,
): { toh?: string } => {
  const toh = serializeTohList(annotation.toh);
  return toh ? { [TOH_ATTR]: toh } : {};
};

/**
 * Copies a toh scope read off a node or mark onto the annotation exported from
 * it. Applied at the export choke points so every annotation type round-trips
 * its scope without each exporter restating it.
 */
export const withToh = <T extends { toh?: TohokuCatalogEntry[] }>(
  annotation: T,
  attrs: Record<string, unknown> | undefined,
): T => {
  const toh = tohFromAttrs(attrs);
  return toh.length ? { ...annotation, toh } : annotation;
};
