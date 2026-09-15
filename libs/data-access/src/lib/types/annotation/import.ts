import type { AnnotationDTOType } from './annotation-type';
import {
  type Annotation,
  type AnnotationImporter,
  type ImportAnnotationInput,
} from './annotation';
import { importer as blockquote } from './blockquote';
import { importer as endNoteLink } from './end-note-link';
import { importer as glossaryInstance } from './glossary-instance';
import { importer as heading } from './heading';
import { importer as indent } from './indent';
import { importer as inlineTitle } from './inline-title';
import { importer as leadingSpace } from './leading-space';
import { importer as line } from './line';
import { importer as lineGroup } from './line-group';
import { importer as link } from './link';
import { importer as mantra } from './mantra';
import { importer as mention } from './mention';
import { importer as paragraph } from './paragraph';
import { importer as span } from './span';
import { importer as trailer } from './trailer';

/**
 * Importers keyed by the annotation kind an import can emit. Any kind without
 * one resolves to no importer and is dropped by `annotationFromImport`. Keys
 * reuse the `AnnotationDTOType` vocabulary so the kind an agent supplies
 * matches the database annotation types.
 *
 * The first eight are what a `.docx` produces. The rest exist because an import
 * is no longer only a first fill: a pass that edits a populated passage has to
 * send that passage's whole annotation set back, and anything it cannot express
 * here is deleted as absent by `savePassagesWithDeletions`.
 */
export const importAnnotationMap: Partial<
  Record<AnnotationDTOType, AnnotationImporter>
> = {
  blockquote,
  paragraph,
  indent,
  line,
  'line-group': lineGroup,
  span,
  link,
  heading,
  'end-note-link': endNoteLink,
  'glossary-instance': glossaryInstance,
  'inline-title': inlineTitle,
  'leading-space': leadingSpace,
  mantra,
  mention,
  trailer,
};

/**
 * Builds a domain annotation from a mapped document annotation, dispatching by
 * kind. Returns null when the kind is not importable or the importer rejects
 * the input (e.g. a link with no href).
 */
export const annotationFromImport = (
  kind: string,
  input: ImportAnnotationInput,
): Annotation | null => {
  const importer = importAnnotationMap[kind as AnnotationDTOType];
  return importer ? importer(input) : null;
};
