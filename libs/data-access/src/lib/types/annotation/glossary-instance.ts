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

    if (content.authority) {
      glossaryInstance.authority = content.authority as string;
    }
  });
  return glossaryInstance;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { glossary: uuid, authority } =
    annotation as GlossaryInstanceAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    uuid,
    authority,
  });
  return dto;
};

export const importer: AnnotationImporter = (
  input,
): GlossaryInstanceAnnotation | null => {
  const glossary = input.data?.glossary;
  const authority = input.data?.authority;
  if (typeof glossary !== 'string' || typeof authority !== 'string') {
    // Both halves identify the term; one alone cannot be resolved.
    return null;
  }
  const instance = baseAnnotationFromImport(
    input,
    'glossaryInstance',
  ) as GlossaryInstanceAnnotation;
  instance.glossary = glossary;
  instance.authority = authority;
  return instance;
};
