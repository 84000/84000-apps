import { Extension } from '@tiptap/core';
import { ANNOTATION_TOH_TYPES } from '@eightyfourthousand/lib-doc-model';

/**
 * Declares the `toh` attribute on every node and mark that maps to an
 * annotation.
 *
 * `toh` is on `AnnotationBase`, so any annotation may be scoped to a subset of
 * a work's Tohoku texts — production carries a scope on 18 distinct annotation
 * types. ProseMirror builds a node's attributes from its *spec* (`computeAttrs`
 * iterates the declared attributes, not the supplied value), so an undeclared
 * `toh` is dropped the moment the document is built: the editor exports the
 * annotation without a scope, and the save path overwrites the column.
 *
 * Declaring it in one global extension rather than in ~30 `addAttributes()`
 * blocks means a new annotation-bearing type only has to be added to
 * `ANNOTATION_TOH_TYPES`.
 *
 * The rendered `data-toh` is what the reader's toh-visibility rule
 * (`useTohToggle`) reads to hide markup belonging to an inactive Tohoku text.
 */
export const AnnotationToh = Extension.create({
  name: 'annotationToh',

  addGlobalAttributes() {
    return [
      {
        types: [...ANNOTATION_TOH_TYPES],
        attributes: {
          toh: {
            default: undefined,
            parseHTML: (element: HTMLElement) =>
              element.getAttribute('data-toh') || undefined,
            renderHTML: (attributes: Record<string, unknown>) =>
              attributes.toh ? { 'data-toh': attributes.toh as string } : {},
          },
        },
      },
    ];
  },
});
