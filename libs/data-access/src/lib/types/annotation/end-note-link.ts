import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type EndNoteLinkAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): EndNoteLinkAnnotation => {
  const baseAnnotation = baseAnnotationFromDTO(dto);
  const endNote = baseAnnotation as EndNoteLinkAnnotation;
  dto.content.forEach((content) => {
    if (content.uuid) {
      endNote.endNote = content.uuid as string;
    }

    if (content.label) {
      endNote.label = content.label as string;
    }
  });

  return endNote;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { endNote: uuid } = annotation as EndNoteLinkAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    uuid,
  });
  return dto;
};

export const importer: AnnotationImporter = (
  input,
): EndNoteLinkAnnotation | null => {
  const endNote = input.data?.endNote;
  if (typeof endNote !== 'string' || !endNote) {
    // The marker is meaningless without the note it points at.
    return null;
  }
  const link = baseAnnotationFromImport(
    input,
    'endNoteLink',
  ) as EndNoteLinkAnnotation;
  link.endNote = endNote;
  if (typeof input.data?.label === 'string') {
    link.label = input.data.label;
  }
  return link;
};
