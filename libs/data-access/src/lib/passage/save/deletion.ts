import type { DataClient } from '../../types';
import { normalizePassageLabelsAfter } from './labels';
import type { RenumberedPassageRow, StepError } from './types';

/**
 * Delete passages, their annotations and the endnote links that point at
 * them, then renumber the labels after each.
 *
 * All annotation cleanup runs before the passage delete, so a failure aborts
 * while the passage rows still exist and a retry can redo the whole sequence.
 */
export const deletePassages = async ({
  client,
  deletedUuids,
  clientRenumberedUuids,
}: {
  client: DataClient;
  deletedUuids: string[];
  /** Passages in the save's payload; see `normalizePassageLabelsAfter`. */
  clientRenumberedUuids: Set<string>;
}): Promise<
  { deletedCount: number; renumbered: RenumberedPassageRow[] } | StepError
> => {
  const renumberedRows: RenumberedPassageRow[] = [];
  const { data: deletedPassages, error: deletedFetchError } = await client
    .from('passages')
    .select('uuid, sort, label, work_uuid')
    .in('uuid', deletedUuids);

  if (deletedFetchError) {
    console.error(
      'Error fetching passages marked for deletion:',
      deletedFetchError,
    );
    return {
      error: `Failed to fetch passages marked for deletion: ${deletedFetchError.message}`,
    };
  }

  if (deletedPassages && deletedPassages.length > 0) {
    const sortedDeleted = [...deletedPassages].sort((a, b) => b.sort - a.sort);

    // All annotation cleanup runs before the passage delete: if any step
    // fails we abort while the passage rows still exist, so a retry can
    // redo the whole sequence.
    const { error: deleteAnnotationsError } = await client
      .from('passage_annotations')
      .delete()
      .in('passage_uuid', deletedUuids);

    if (deleteAnnotationsError) {
      console.error(
        'Error deleting annotations for deleted passages:',
        deleteAnnotationsError,
      );
      return {
        error: `Failed to delete annotations for deleted passages: ${deleteAnnotationsError.message}`,
      };
    }

    // Cascade: remove `endNoteLink` annotations on OTHER passages that
    // reference any deleted endnote passage. These live on the referencing
    // (translation/front) passages, not on the deleted note itself, so the
    // delete-by-passage_uuid above never reaches them. Left behind, they
    // become orphaned references that render as a stray "*". Doing this
    // server-side fixes the case where the referencing passage is not loaded
    // in the editor (so client-side cleanup can't reach it).
    for (const deletedUuid of deletedUuids) {
      const { data: referencingAnnotations, error: findReferencesError } =
        await client
          .from('passage_annotations')
          .select('uuid')
          .eq('type', 'end-note-link')
          .filter('content', 'cs', JSON.stringify([{ uuid: deletedUuid }]));

      if (findReferencesError) {
        console.error(
          'Error finding endnote-link references to deleted passage:',
          findReferencesError,
        );
        return {
          error: `Failed to find endnote-link references to deleted passage: ${findReferencesError.message}`,
        };
      }

      const referenceUuids = (referencingAnnotations ?? []).map(
        (annotation) => annotation.uuid,
      );

      if (referenceUuids.length > 0) {
        const { error: deleteReferencesError } = await client
          .from('passage_annotations')
          .delete()
          .in('uuid', referenceUuids);

        if (deleteReferencesError) {
          console.error(
            'Error deleting endnote-link references to deleted passage:',
            deleteReferencesError,
          );
          return {
            error: `Failed to delete endnote-link references to deleted passage: ${deleteReferencesError.message}`,
          };
        }
      }
    }

    const { error: deletePassagesError } = await client
      .from('passages')
      .delete()
      .in('uuid', deletedUuids);

    if (deletePassagesError) {
      console.error('Error deleting passages:', deletePassagesError);
      return {
        error: `Failed to delete passages: ${deletePassagesError.message}`,
      };
    }

    // Renumber neighbors only after the delete succeeded — renumbering
    // first would leave labels shifted while the passage still exists if
    // the delete failed. The deleted rows' sort/label were captured above.
    for (const deletedPassage of sortedDeleted) {
      const { error, renumbered } = await normalizePassageLabelsAfter({
        client,
        workUuid: deletedPassage.work_uuid,
        fromSort: deletedPassage.sort,
        fromLabel: deletedPassage.label,
        delta: -1,
        clientRenumberedUuids,
      });
      renumbered.forEach((row) => renumberedRows.push(row));
      if (error) {
        return {
          error: `Passages deleted but labels were not renumbered: ${error}`,
        };
      }
    }
  }

  return {
    deletedCount: deletedPassages?.length ?? 0,
    renumbered: renumberedRows,
  };
};
