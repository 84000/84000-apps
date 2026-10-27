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
      internalLink.linkStatus = content['link-type'] as string;
    }

    if (content.type) {
      internalLink.linkType = content['type'] as string;
    }

    // Stored labels include the empty string; keep it as stored.
    if (typeof content.label === 'string') {
      internalLink.label = content.label;
    }

    if (content.uuid) {
      internalLink.entity = content.uuid as string;
    }

    if (content.same_work !== undefined) {
      internalLink.isSameWork = !!content.same_work;
    }

    if (content.subtype) {
      internalLink.subtype = content.subtype as string;
    }

    if (content.toh) {
      internalLink.linkToh = content.toh as string;
    }
  });

  return internalLink;
};

export const exporter: AnnotationExporter = (annotation): AnnotationDTO => {
  const {
    entity,
    linkType,
    href,
    label,
    isPending,
    linkStatus,
    isSameWork,
    subtype,
    linkToh,
  } = annotation as InternalLinkAnnotation;
  const dto = baseAnnotationToDto(annotation);
  dto.content = [
    {
      href,
    },
  ];

  if (linkStatus || isPending) {
    dto.content.push({
      'link-type': linkStatus || 'pending',
    });
  }

  if (label !== undefined) {
    dto.content.push({
      label,
    });
  }

  if (entity) {
    dto.content.push({
      uuid: entity,
    });
  }

  if (linkType) {
    dto.content.push({
      type: linkType,
    });
  }

  if (isSameWork !== undefined) {
    dto.content.push({
      same_work: isSameWork,
    });
  }

  if (subtype) {
    dto.content.push({
      subtype,
    });
  }

  // The target's Tohoku number, distinct from the row's own `toh` scope.
  if (linkToh) {
    dto.content.push({
      toh: linkToh,
    });
  }

  return dto;
};
