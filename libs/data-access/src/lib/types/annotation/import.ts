import type { AnnotationDTOType } from './annotation-type';
import {
  type Annotation,
  type AnnotationImporter,
  type ImportAnnotationInput,
} from './annotation';
import { importer as blockquote } from './blockquote';
import { importer as heading } from './heading';
import { importer as indent } from './indent';
import { importer as line } from './line';
import { importer as lineGroup } from './line-group';
import { importer as link } from './link';
import { importer as paragraph } from './paragraph';
import { importer as span } from './span';

/**
 * Importers keyed by the annotation kind a document mapping can emit. Only the
 * kinds the docx importer produces are registered; any other kind resolves to
 * no importer and is dropped by `annotationFromImport`. Keys reuse the
 * `AnnotationDTOType` vocabulary so the kind an agent supplies matches the
 * database annotation types.
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
