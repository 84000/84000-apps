import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type GlossaryInstanceAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): GlossaryInstanceAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const glossaryInstance = baseAnnotation as GlossaryInstanceAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      glossaryInstance.glossary = content.uuid as string;
    }
    // A stored `authority` is a legacy copy of the entry's; it is ignored.
    // The authority is read from the entry the uuid names.
  });
  return glossaryInstance;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { glossary: uuid } = annotation as GlossaryInstanceAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({ uuid });
  return dto;
};

export const importer: AnnotationImporter = (
  input,
): GlossaryInstanceAnnotation | null => {
  // The entry's uuid alone identifies the term. A caller's `authority` is
  // ignored: the authority is read from the entry.
  const glossary = input.data?.glossary;
  if (typeof glossary !== 'string' || !glossary) {
    return null;
  }
  const instance = baseAnnotationFromImport(
    input,
    'glossaryInstance',
  ) as GlossaryInstanceAnnotation;
  instance.glossary = glossary;
  return instance;
};
