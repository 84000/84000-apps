import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationImporter,
  type AnnotationTransformer,
  type LinkAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationFromImport,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (dto): LinkAnnotation => {
  const linkAnnotation = baseAnnotationFromDTO(dto) as LinkAnnotation;
  dto.content.forEach((content) => {
    if (content.title) {
      linkAnnotation.text = content.title as string;
    }

    if (content.href) {
      linkAnnotation.href = content.href as string;
    }
  });

  return linkAnnotation;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { href, text } = annotation as LinkAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content.push({
    href,
  });

  if (text) {
    dto.content.push({
      title: text,
    });
  }
  return dto;
};

export const importer: AnnotationImporter = (input): LinkAnnotation | null => {
  const href = input.data?.href;
  if (typeof href !== 'string' || !href) {
    // A link with no target cannot be represented; drop it.
    return null;
  }
  const link = baseAnnotationFromImport(input, 'link') as LinkAnnotation;
  link.href = href;
  link.text = input.passageText.slice(input.start, input.end);
  return link;
};
