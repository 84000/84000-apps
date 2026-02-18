import { blockFromPassage } from '@lib-editing';
import {
  annotationsFromDTO,
  alignmentsFromDTO,
  alignmentFromDTO,
  type Passage as DataAccessPassage,
  type BodyItemType,
  type AnnotationDTO,
  TohokuCatalogEntry,
} from '@data-access';
import type { GraphQLContext } from '../../context';
import {
  transformAnnotation,
  type AnnotationEnrichmentContext,
} from '../annotation/annotation.resolver';

/**
 * Parent object passed from the passages resolver.
 * Contains only base passage data - annotations/alignments are loaded by field resolvers.
 */
interface PassageParent {
  uuid: string;
  content: string;
  label: string;
  sort: number;
  type: string;
  xmlId: string | null;
  toh: TohokuCatalogEntry | null;
  workUuid: string;
}

/**
 * Builds enrichment context for endNoteLink annotations.
 * Fetches labels for referenced endNote passages.
 */
async function buildEnrichment(
  annotations: AnnotationDTO[],
  ctx: GraphQLContext,
): Promise<AnnotationEnrichmentContext> {
  const endNoteUuids = annotations
    .filter((a) => a.type === 'end-note-link')
    .flatMap((a) => {
      const content = a.content as Array<{ uuid?: string }> | undefined;
      return content?.filter((c) => c.uuid).map((c) => c.uuid as string) ?? [];
    });

  if (endNoteUuids.length === 0) {
    return {};
  }

  // Batch-fetch labels using the DataLoader
  const labels = await ctx.loaders.passageLabelsByUuid.loadMany(endNoteUuids);

  const endNoteLabels = new Map<string, string>();
  endNoteUuids.forEach((uuid, i) => {
    const label = labels[i];
    if (typeof label === 'string') {
      endNoteLabels.set(uuid, label);
    }
  });

  return { endNoteLabels };
}

/**
 * Field resolver for Passage.annotations.
 * Loads annotations via DataLoader (batched across all passages in the request).
 */
export const passageAnnotationsResolver = async (
  parent: PassageParent,
  _args: unknown,
  ctx: GraphQLContext,
) => {
  // Load annotations via DataLoader (batched with other passages)
  const annotations = await ctx.loaders.annotationsByPassageUuid.load(
    parent.uuid,
  );

  // Build enrichment for endNoteLink annotations
  const enrichment = await buildEnrichment(annotations, ctx);

  // Transform to GraphQL format
  return annotations.map((a) =>
    transformAnnotation(a, parent.content.length, enrichment),
  );
};

/**
 * Field resolver for Passage.alignments.
 * Loads alignments via DataLoader (batched across all passages in the request).
 */
export const passageAlignmentsResolver = async (
  parent: PassageParent,
  _args: unknown,
  ctx: GraphQLContext,
) => {
  const alignments = await ctx.loaders.alignmentsByPassageUuid.load(
    parent.uuid,
  );
  return alignments.map(alignmentFromDTO);
};

/**
 * Enriches annotation DTOs with endNote labels.
 * Modifies the DTOs in place to add labels to end-note-link annotations.
 */
async function enrichAnnotationDTOs(
  annotations: AnnotationDTO[],
  ctx: GraphQLContext,
): Promise<void> {
  // Extract endNote UUIDs and their annotation indices
  const endNoteRefs: Array<{ annotationIndex: number; uuid: string }> = [];

  annotations.forEach((a, index) => {
    if (a.type === 'end-note-link') {
      const content = a.content as Array<{ uuid?: string }> | undefined;
      content?.forEach((c) => {
        if (c.uuid) {
          endNoteRefs.push({ annotationIndex: index, uuid: c.uuid });
        }
      });
    }
  });

  if (endNoteRefs.length === 0) {
    return;
  }

  // Batch-fetch labels using the DataLoader
  const uuids = endNoteRefs.map((ref) => ref.uuid);
  const labels = await ctx.loaders.passageLabelsByUuid.loadMany(uuids);

  // Inject labels into the annotation DTOs
  endNoteRefs.forEach((ref, i) => {
    const label = labels[i];
    if (typeof label === 'string') {
      const annotation = annotations[ref.annotationIndex];
      const content = annotation.content as Array<{
        uuid?: string;
        label?: string;
      }>;
      // Find the content item with this UUID and add the label
      const contentItem = content.find((c) => c.uuid === ref.uuid);
      if (contentItem) {
        // Extract only the part after the last dot (e.g., "1.2.3" -> "3")
        const lastDotIndex = label.lastIndexOf('.');
        contentItem.label =
          lastDotIndex >= 0 ? label.slice(lastDotIndex + 1) : label;
      }
    }
  });
}

/**
 * Field resolver for Passage.json.
 * Loads both annotations and alignments, then transforms to TipTap editor JSON.
 */
export const passageJsonResolver = async (
  parent: PassageParent,
  _args: unknown,
  ctx: GraphQLContext,
) => {
  // Load both annotations and alignments in parallel
  const [rawAnnotations, rawAlignments] = await Promise.all([
    ctx.loaders.annotationsByPassageUuid.load(parent.uuid),
    ctx.loaders.alignmentsByPassageUuid.load(parent.uuid),
  ]);

  // Enrich annotations with endNote labels before transformation
  await enrichAnnotationDTOs(rawAnnotations, ctx);

  const passage: DataAccessPassage = {
    uuid: parent.uuid,
    content: parent.content,
    label: parent.label,
    sort: parent.sort,
    type: parent.type as BodyItemType,
    workUuid: parent.workUuid,
    toh: (parent.toh as TohokuCatalogEntry) ?? undefined,
    xmlId: parent.xmlId ?? undefined,
    annotations: annotationsFromDTO(rawAnnotations, parent.content.length),
    alignments: alignmentsFromDTO(rawAlignments),
  };

  return blockFromPassage(passage);
};
