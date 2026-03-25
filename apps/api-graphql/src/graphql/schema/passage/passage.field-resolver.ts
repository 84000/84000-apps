import { blockFromPassage } from '@eightyfourthousand/lib-editing';
import {
  annotationsFromDTO,
  alignmentsFromDTO,
  alignmentFromDTO,
  type Passage as DataAccessPassage,
  type BodyItemType,
  type AnnotationDTO,
  type TohokuCatalogEntry,
  type MentionAnnotation,
} from '@eightyfourthousand/data-access';
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
 * Resolves display texts for mention annotations by batch-fetching
 * labels from the target entities based on their linkType.
 * Returns a map of annotation UUID → resolved display text.
 */
async function resolveMentionTexts(
  annotations: AnnotationDTO[],
  ctx: GraphQLContext,
): Promise<Map<string, string>> {
  const mentionTexts = new Map<string, string>();

  // Extract mentions that need resolution (skip those with custom text override)
  const mentions: Array<{
    annotationUuid: string;
    entityUuid: string;
    linkType: string;
  }> = [];

  for (const a of annotations) {
    if (a.type !== 'mention') continue;
    const content = a.content as Array<{
      uuid?: string;
      type?: string;
      text?: string;
    }>;
    const entityUuid = content?.find((c) => c.uuid)?.uuid;
    const linkType = content?.find((c) => c.type)?.type;
    const hasCustomText = content?.some((c) => c.text);

    if (!entityUuid || !linkType || hasCustomText) continue;
    mentions.push({ annotationUuid: a.uuid, entityUuid, linkType });
  }

  if (mentions.length === 0) return mentionTexts;

  // Group by linkType for batched fetching
  const byType = new Map<string, typeof mentions>();
  for (const m of mentions) {
    const group = byType.get(m.linkType) || [];
    group.push(m);
    byType.set(m.linkType, group);
  }

  // Fetch labels per linkType
  const fetchPromises: Promise<void>[] = [];

  const passageMentions = byType.get('passage');
  if (passageMentions) {
    fetchPromises.push(
      ctx.loaders.passageLabelsByUuid
        .loadMany(passageMentions.map((m) => m.entityUuid))
        .then((labels) => {
          passageMentions.forEach((m, i) => {
            const label = labels[i];
            if (typeof label === 'string') {
              mentionTexts.set(m.annotationUuid, label);
            }
          });
        }),
    );
  }

  const workMentions = byType.get('work');
  if (workMentions) {
    fetchPromises.push(
      ctx.loaders.workTitlesByUuid
        .loadMany(workMentions.map((m) => m.entityUuid))
        .then((titles) => {
          workMentions.forEach((m, i) => {
            const title = titles[i];
            if (typeof title === 'string') {
              mentionTexts.set(m.annotationUuid, title);
            }
          });
        }),
    );
  }

  const glossaryMentions = byType.get('glossary');
  if (glossaryMentions) {
    fetchPromises.push(
      ctx.loaders.glossaryNamesByUuid
        .loadMany(glossaryMentions.map((m) => m.entityUuid))
        .then((names) => {
          glossaryMentions.forEach((m, i) => {
            const name = names[i];
            if (typeof name === 'string') {
              mentionTexts.set(m.annotationUuid, name);
            }
          });
        }),
    );
  }

  // Bibliography gets a static label
  const bibMentions = byType.get('bibliography');
  if (bibMentions) {
    for (const m of bibMentions) {
      mentionTexts.set(m.annotationUuid, 'Bibliography');
    }
  }

  await Promise.all(fetchPromises);
  return mentionTexts;
}

/**
 * Builds enrichment context for annotations.
 * Fetches labels for referenced endNote passages and mention display texts.
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

  // Fetch endNote labels and mention texts in parallel
  const [endNoteLabelsResult, mentionTexts] = await Promise.all([
    endNoteUuids.length > 0
      ? ctx.loaders.passageLabelsByUuid.loadMany(endNoteUuids)
      : Promise.resolve([]),
    resolveMentionTexts(annotations, ctx),
  ]);

  const endNoteLabels = new Map<string, string>();
  endNoteUuids.forEach((uuid, i) => {
    const label = endNoteLabelsResult[i];
    if (typeof label === 'string') {
      endNoteLabels.set(uuid, label);
    }
  });

  return {
    ...(endNoteLabels.size > 0 && { endNoteLabels }),
    ...(mentionTexts.size > 0 && { mentionTexts }),
  };
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
 * Field resolver for Passage.references.
 * Loads passages that reference this endnote passage via end-note-link annotations.
 * Only returns results for endnotes type passages.
 */
export const passageReferencesResolver = async (
  parent: PassageParent,
  _args: unknown,
  ctx: GraphQLContext,
) => {
  if (parent.type !== 'endnotes') {
    return [];
  }
  return ctx.loaders.passageReferencesByPassageUuid.load(parent.uuid);
};

/**
 * Field resolver for Passage.json.
 * Loads both annotations and alignments, then transforms to TipTap editor JSON.
 */
export const passageJsonResolver = async (
  parent: PassageParent,
  _args: unknown,
  ctx: GraphQLContext,
) => {
  const isEndnotes = parent.type === 'endnotes';

  // Load annotations, alignments, and (for endnotes) references in parallel
  const [rawAnnotations, rawAlignments, references] = await Promise.all([
    ctx.loaders.annotationsByPassageUuid.load(parent.uuid),
    ctx.loaders.alignmentsByPassageUuid.load(parent.uuid),
    isEndnotes
      ? ctx.loaders.passageReferencesByPassageUuid.load(parent.uuid)
      : Promise.resolve([]),
  ]);

  // Enrich annotations with endNote labels and mention display texts before transformation
  const [, mentionTexts] = await Promise.all([
    enrichAnnotationDTOs(rawAnnotations, ctx),
    resolveMentionTexts(rawAnnotations, ctx),
  ]);

  const annotations = annotationsFromDTO(rawAnnotations, parent.content.length);

  // Set displayText on parsed MentionAnnotation objects (avoids DTO mutation)
  for (const annotation of annotations) {
    if (annotation.type === 'mention') {
      const mention = annotation as MentionAnnotation;
      const resolvedText = mentionTexts.get(mention.uuid);
      if (resolvedText) {
        mention.displayText = resolvedText;
      }
    }
  }

  const passage: DataAccessPassage = {
    uuid: parent.uuid,
    content: parent.content,
    label: parent.label,
    sort: parent.sort,
    type: parent.type as BodyItemType,
    workUuid: parent.workUuid,
    toh: (parent.toh as TohokuCatalogEntry) ?? undefined,
    xmlId: parent.xmlId ?? undefined,
    annotations,
    alignments: alignmentsFromDTO(rawAlignments),
    references: references
  };

  return blockFromPassage(passage);
};
