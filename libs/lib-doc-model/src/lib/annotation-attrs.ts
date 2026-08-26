import { AnnotationType } from '@eightyfourthousand/data-access';
import type { TranslationEditorContentType } from './transformers/transformer';

/**
 * The two "parameter" annotations — the ones that live as an attribute on a
 * host block rather than as a node or mark of their own — and the plumbing they
 * share.
 *
 * They used to be spread across parallel lists in four places: a `hasX` flag, an
 * `xUuid` attribute, and a per-type name in each list that had to be kept in
 * sync by hand. They are one registry here, so a new parameter annotation is
 * declared once.
 */

/**
 * A parameter annotation's stored value.
 *
 * Object-valued — `{ uuid }` or absent — so an annotation's presence and its
 * identity are one value that moves together. The previous flat
 * `hasIndent` / `indentUuid` pair could be split by any code path that copied
 * one and not the other, and a `null` uuid was indistinguishable from a block
 * that simply had no indent.
 */
export type ParameterAnnotationValue = {
  uuid: string;
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

  const { uuid } = value as Partial<ParameterAnnotationValue>;
  return uuid ? { uuid } : undefined;
};
