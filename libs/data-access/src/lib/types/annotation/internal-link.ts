import type { AnnotationDTO } from './annotation-type';
import {
  type AnnotationExporter,
  type AnnotationTransformer,
  type InternalLinkAnnotation,
  baseAnnotationFromDTO,
  baseAnnotationToDto,
} from './annotation';

export const transformer: AnnotationTransformer = (
  dto,
): InternalLinkAnnotation => {
  const internalLink = baseAnnotationFromDTO(dto) as InternalLinkAnnotation;
  dto.content.forEach((content) => {
    if (content.href) {
      internalLink.href = content.href as string;
    }

    if (content['link-type']) {
      internalLink.isPending = true;
    }

    if (content.type) {
      internalLink.linkType = content['type'] as string;
    }

    if (content.label) {
      internalLink.label = content.label as string;
    }
  });

  return internalLink;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const { linkType, href, label, isPending } =
    annotation as InternalLinkAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content = [
    {
      href,
    },
  ];

  if (isPending) {
    dto.content.push({
      'link-type': 'pending',
    });
  }

  if (label) {
    dto.content.push({
      label,
    });
  }

  if (linkType) {
    dto.content.push({
      type: linkType,
    });
  }

  return dto;
};
