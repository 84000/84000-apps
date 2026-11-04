import type { ImportOperationInput } from '../types';
import { applyWorkEdits } from './apply-work-edits';
import type { WorkEditOp, WorkMetadataChanges } from './types';

/**
 * Import operations as work edit ops. Accepts `upsert_folio_annotation`,
 * the kind the import tool takes, as well as `update_folio_annotation`.
 */
export const workEditOpsFromImport = (
  operations: ImportOperationInput[],
): WorkEditOp[] =>
  operations.map((operation): WorkEditOp => {
    const kind = operation.kind as string;
    if (operation.kind === 'update_work') {
      return { op: 'update-work', patch: operation.patch };
    }
    if (operation.kind === 'upsert_title') {
      return { op: 'upsert-title', title: operation.title };
    }
    if (operation.kind === 'upsert_passage') {
      return {
        op: 'upsert-passage',
        passage: operation.passage,
        annotations: operation.annotations,
      };
    }
    if (
      kind === 'update_folio_annotation' ||
      kind === 'upsert_folio_annotation'
    ) {
      return {
        op: 'upsert-folio-annotation',
        patch: (operation as { patch: Record<string, unknown> }).patch,
      };
    }
    throw new Error(`Nothing was saved: unknown operation kind ${kind}`);
  });

/**
 * Applies import operations to a target work through `applyWorkEdits`:
 * work metadata, titles and folio source description, then passages (with
 * their annotations) via the shared passage save path. Throws with the
 * failure's message when anything is refused or fails.
 */
export const applyImportPreview = async ({
  client,
  workUuid,
  operations,
}: {
  client: Parameters<typeof applyWorkEdits>[0]['client'];
  workUuid: string;
  operations: ImportOperationInput[];
}) => {
  const result = await applyWorkEdits({
    client,
    workUuid,
    ops: workEditOpsFromImport(operations),
  });
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to apply the import.');
  }

  const metadata = result.groups.find(
    (group) => group.group === 'work-metadata',
  )?.changes as WorkMetadataChanges | undefined;
  const passages = result.groups.find(
    (group) => group.group === 'passages',
  )?.changes;
  const titles = metadata?.titles ?? [];
  const written = passages?.group === 'passages' ? passages.passages : [];

  return {
    counts: {
      workUpdates: metadata?.work ? 1 : 0,
      titles: titles.filter((title) => title.action === 'insert').length,
      titlesUpdated: titles.filter((title) => title.action === 'update').length,
      folioUpdates: metadata?.folioAnnotation?.rows ?? 0,
      passages: written.length,
      annotations: written.reduce(
        (count, passage) => count + passage.annotations,
        0,
      ),
    },
    warnings: result.groups.flatMap((group) =>
      group.warnings.map((warning) => warning.message),
    ),
  };
};
