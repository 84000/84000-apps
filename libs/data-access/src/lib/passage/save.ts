import {
  ANNOTATIONS_TO_IGNORE,
  BodyItemType,
  DataClient,
  AnnotationDTO,
  Passage,
  PassageRowDTO,
  TohokuCatalogEntry,
  passagesToDTO,
  passagesToRowDTO,
} from '../types';
import { getPassageSorts } from './read';

const SAVE_PAGE_SIZE = 500;

async function normalizePassageLabelsAfter({
  client,
  workUuid,
  fromSort,
  fromLabel,
  delta,
  clientRenumberedUuids,
}: {
  client: DataClient;
  workUuid: string;
  fromSort: number;
  fromLabel: string;
  delta: number;
  /**
   * Passages in this save's payload. The editor renumbers the passages it has
   * loaded before saving, so those rows already carry their expected label —
   * which must not be read as "the rest of the series is already correct".
   * See the `expectedLabel` check below.
   */
  clientRenumberedUuids?: Set<string>;
}): Promise<{ error?: string; renumbered: RenumberedPassageRow[] }> {
  const parts = fromLabel.split('.');
  const depth = parts.length;
  const prefix = depth > 1 ? `${parts.slice(0, -1).join('.')}.` : '';
  let nextInt = Number.parseInt(parts[depth - 1], 10) + Math.max(delta, 0);
  let lastSort = fromSort;
  let done = false;
  const renumbered: RenumberedPassageRow[] = [];

  // A label is a slot, not a row. A work covering several Tohoku texts can hold
  // per-text variants of one note — same label, distinguished by a non-null
  // `toh` — so those rows must all land on the same new number. Advancing per
  // row instead of per slot fans one slot out across several numbers and
  // cascades through the rest of the sequence.
  //
  // `toh` is what makes variants identifiable, and it is load-bearing here:
  // matching on the label alone would also group the row the client just
  // renumbered with the stale row behind it, which transiently share a label
  // mid-save. A `toh`-less row always stands alone in its slot.
  let previousLabel: string | undefined;
  let previousToh: unknown = null;
  let previousAssignedLabel: string | undefined;

  // Passages can share a sort — per-text variants of one label routinely do —
  // so paging with `sort > lastSort` silently drops the ones that share the
  // last row of a page. Pages after the first are fetched with `>=` and the
  // rows already handled are skipped by uuid instead.
  const processedUuids = new Set<string>();
  let isFirstPage = true;

  while (!done) {
    const query = client
      .from('passages')
      .select('uuid, label, sort, toh')
      .eq('work_uuid', workUuid);

    const { data, error } = await (
      isFirstPage ? query.gt('sort', lastSort) : query.gte('sort', lastSort)
    )
      .order('sort', { ascending: true })
      .limit(SAVE_PAGE_SIZE);

    if (error) {
      console.error('Error fetching passages for label normalization:', error);
      return { error: error.message, renumbered };
    }
    if (!data || data.length === 0) break;

    const labelUpdates: { uuid: string; label: string }[] = [];
    const prefixRenames: { oldPrefix: string; newPrefix: string }[] = [];

    let newRowsThisPage = 0;

    for (const row of data) {
      if (processedUuids.has(row.uuid)) {
        continue;
      }
      processedUuids.add(row.uuid);
      newRowsThisPage++;

      const rowParts = (row.label ?? '').split('.');

      if (rowParts.length < depth || !row.label?.startsWith(prefix)) {
        done = true;
        break;
      }

      if (rowParts.length > depth) continue;

      // Another per-text variant of the slot the previous row belonged to.
      const rowToh = (row as { toh?: unknown }).toh ?? null;
      const isSameSlot =
        previousLabel !== undefined &&
        row.label === previousLabel &&
        rowToh !== null &&
        previousToh !== null;
      const expectedLabel = isSameSlot
        ? (previousAssignedLabel as string)
        : prefix + nextInt;

      if (!isSameSlot && row.label === expectedLabel) {
        // Normally a row already holding its expected label means the tail of
        // the sequence is contiguous and there is nothing left to do. That does
        // not hold for a row the client renumbered in this same save: the
        // editor only holds a window of the sequence, so rows past that window
        // are still stale. Step over it and keep walking.
        if (clientRenumberedUuids?.has(row.uuid)) {
          previousLabel = row.label;
          previousToh = rowToh;
          previousAssignedLabel = expectedLabel;
          nextInt++;
          continue;
        }
        done = true;
        break;
      }

      if (row.label !== expectedLabel) {
        labelUpdates.push({ uuid: row.uuid, label: expectedLabel });
        // One rename per slot — the variants share both prefixes.
        if (!isSameSlot) {
          prefixRenames.push({
            oldPrefix: `${row.label}.`,
            newPrefix: `${expectedLabel}.`,
          });
        }
      }

      previousLabel = row.label;
      previousToh = rowToh;
      previousAssignedLabel = expectedLabel;
      if (!isSameSlot) {
        nextInt++;
      }
    }

    if (labelUpdates.length > 0) {
      const { error: upsertError } = await client
        .from('passages')
        .upsert(labelUpdates, { onConflict: 'uuid' });
      if (upsertError) {
        console.error('Error normalizing passage labels:', upsertError);
        return { error: upsertError.message, renumbered };
      }

      renumbered.push(...labelUpdates);

      for (const { oldPrefix, newPrefix } of prefixRenames) {
        const { error: prefixError } = await client.rpc(
          'rename_passage_label_prefix',
          {
            p_work_uuid: workUuid,
            p_old_prefix: oldPrefix,
            p_new_prefix: newPrefix,
          },
        );
        if (prefixError) {
          console.error('Error renaming passage label prefix:', prefixError);
          return { error: prefixError.message, renumbered };
        }
      }
    }

    if (done || data.length < SAVE_PAGE_SIZE) break;

    // A full page of rows already handled means every row shares one sort and
    // the `>=` re-read cannot advance. Stop rather than loop forever; a single
    // sort holding 500+ passages is malformed data, not a case to page through.
    if (newRowsThisPage === 0) {
      console.error(
        `Passage label normalization stalled at sort ${lastSort} for work ${workUuid}: a full page of passages shares one sort.`,
      );
      break;
    }

    lastSort = data[data.length - 1].sort;
    isFirstPage = false;
  }

  return { renumbered };
}

/**
 * A passage whose label the server changed while renumbering a series, rather
 * than because the client sent new content for it. The editor holds only a
 * window of a series, so these are mostly passages it never loaded; it needs
 * them to refresh the labels cached in `endNoteLink` marks without a reload.
 */
export type RenumberedPassageRow = {
  uuid: string;
  label: string;
};

export type SavedPassageRow = {
  uuid: string;
  workUuid: string;
  content: string;
  label: string;
  sort: number;
  type: BodyItemType;
  xmlId: string | null;
  toh: TohokuCatalogEntry | null;
};

export type SavePassagesWithDeletionsResult = {
  success: boolean;
  savedCount: number;
  deletedCount?: number;
  passages: SavedPassageRow[];
  renumberedPassages: RenumberedPassageRow[];
  error?: string;
};

type ExistingPassageRow = PassageRowDTO;

type ExistingAnnotationRow = AnnotationDTO & {
  passage_uuid: string;
};

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(
        ([key, entryValue]) =>
          `${JSON.stringify(key)}:${stableStringify(entryValue)}`,
      )
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

const nullableEqual = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

const passageRowHasChanged = (
  incoming: PassageRowDTO,
  existing?: ExistingPassageRow,
) => {
  if (!existing) {
    return true;
  }

  return (
    incoming.content !== existing.content ||
    incoming.label !== existing.label ||
    incoming.sort !== existing.sort ||
    incoming.type !== existing.type ||
    incoming.work_uuid !== existing.work_uuid ||
    !nullableEqual(incoming.xmlId, existing.xmlId) ||
    !nullableEqual(incoming.parent, existing.parent) ||
    stableStringify(incoming.toh ?? null) !==
      stableStringify(existing.toh ?? null)
  );
};

const annotationHasChanged = (
  incoming: AnnotationDTO,
  existing?: ExistingAnnotationRow,
) => {
  if (!existing) {
    return true;
  }

  return (
    incoming.start !== existing.start ||
    incoming.end !== existing.end ||
    incoming.type !== existing.type ||
    (incoming.passage_uuid ?? incoming.passageUuid ?? '') !==
      existing.passage_uuid ||
    stableStringify(incoming.content ?? []) !==
      stableStringify(existing.content ?? []) ||
    stableStringify(incoming.toh ?? null) !==
      stableStringify(existing.toh ?? null)
  );
};

const failure = (
  error: string,
  savedCount = 0,
): SavePassagesWithDeletionsResult => ({
  success: false,
  savedCount,
  passages: [],
  renumberedPassages: [],
  error,
});

/**
 * Make room for new passages by the saved passage each follows, and choose
 * their sorts.
 *
 * A sort alone is ambiguous when several passages are created together: two
 * new passages after P, or one after P and one after its neighbour Q, can send
 * the same sorts. Grouping by the passage they follow is not. Groups are
 * placed lowest first, each re-reading its anchor's sort because an earlier
 * group's shift can move it. `shift_passage_sorts` only checks that one slot
 * is free, so room for a group is made one slot at a time.
 */
const placeNewPassages = async ({
  client,
  passages,
  insertAfter,
}: {
  client: DataClient;
  passages: Passage[];
  insertAfter: Record<string, string | null>;
}): Promise<{ sorts: Map<string, number> } | { error: string }> => {
  const groups = new Map<string | null, Passage[]>();
  passages.forEach((passage) => {
    const anchor = insertAfter[passage.uuid] ?? null;
    groups.set(anchor, [...(groups.get(anchor) ?? []), passage]);
  });
  // Within a group the client's sorts still give the order.
  groups.forEach((group) => group.sort((a, b) => a.sort - b.sort));

  const anchorSort = async (
    anchor: string | null,
    group: Passage[],
  ): Promise<number | null> => {
    if (anchor) {
      const sorts = await getPassageSorts({ client, uuids: [anchor] });
      if (!sorts) return null;
      const sort = sorts.get(anchor);
      if (sort !== undefined) return sort;
    }
    // Nothing saved before it: take the place the client asked for.
    return group[0].sort - 1;
  };

  const order: { anchor: string | null; at: number }[] = [];
  for (const [anchor, group] of groups) {
    const at = await anchorSort(anchor, group);
    if (at === null) return { error: 'Failed to read anchor passage sorts' };
    order.push({ anchor, at });
  }
  order.sort((a, b) => a.at - b.at);

  const sorts = new Map<string, number>();
  for (const [i, { anchor }] of order.entries()) {
    const group = groups.get(anchor) ?? [];
    // An earlier group's shift may have moved this anchor.
    const at = i === 0 ? order[0].at : await anchorSort(anchor, group);
    if (at === null) return { error: 'Failed to read anchor passage sorts' };
    for (let slot = at + 1; slot <= at + group.length; slot++) {
      const { error } = await client.rpc('shift_passage_sorts', {
        p_work_uuid: group[0].workUuid,
        p_from_sort: slot,
        p_delta: 1,
      });
      if (error) {
        console.error('Error shifting passage sorts:', error);
        return { error: `Failed to shift passage sorts: ${error.message}` };
      }
    }
    group.forEach((passage, offset) =>
      sorts.set(passage.uuid, at + 1 + offset),
    );
  }
  return { sorts };
};

/**
 * Persists edited passages and their annotations, and removes deleted
 * passages.
 *
 * supabase-js provides no transactions, so this runs as a sequence of
 * independent writes ordered to keep the partial-failure window small: sort
 * shifts, then core content upserts, then cosmetic label renumbering, then
 * deletions (labels renumbered only after the delete succeeds), then orphaned
 * annotation cleanup. Every write is an idempotent upsert/delete keyed by
 * uuid, so any failure reported to the client converges when the client
 * retries the same save.
 */
export const savePassagesWithDeletions = async ({
  client,
  passages,
  deletedUuids = [],
  insertAfter,
}: {
  client: DataClient;
  passages: Passage[];
  deletedUuids?: string[];
  /**
   * For each new passage, the uuid of the saved passage it follows, or null
   * when it opens its work. When given for every new passage, the save places
   * them by it and assigns their sorts; see `placeNewPassages`.
   */
  insertAfter?: Record<string, string | null>;
}): Promise<SavePassagesWithDeletionsResult> => {
  const inputUuids = passages.map((p) => p.uuid);
  const { data: existingRows } =
    inputUuids.length > 0
      ? await client
          .from('passages')
          .select(
            'uuid, content, label, sort, type, work_uuid, xmlId, parent, toh',
          )
          .in('uuid', inputUuids)
      : { data: [] };
  const existingUuidSet = new Set((existingRows ?? []).map((r) => r.uuid));
  const newPassages = passages.filter((p) => !existingUuidSet.has(p.uuid));
  const sortedNewPassages = [...newPassages].sort((a, b) => b.sort - a.sort);

  // Make room for new passages before their rows are inserted; a sort
  // collision here would corrupt ordering, so abort on failure.
  const placedSorts = new Map<string, number>();
  if (
    newPassages.length &&
    insertAfter &&
    newPassages.every((passage) => passage.uuid in insertAfter)
  ) {
    const placed = await placeNewPassages({
      client,
      passages: newPassages,
      insertAfter,
    });
    if ('error' in placed) {
      return failure(placed.error);
    }
    placed.sorts.forEach((sort, uuid) => placedSorts.set(uuid, sort));
  } else {
    for (const passage of sortedNewPassages) {
      const { error } = await client.rpc('shift_passage_sorts', {
        p_work_uuid: passage.workUuid,
        p_from_sort: passage.sort,
        p_delta: 1,
      });
      if (error) {
        console.error('Error shifting passage sorts:', error);
        return failure(`Failed to shift passage sorts: ${error.message}`);
      }
    }
  }

  // `existingRows` predates the shifts. An existing passage sent with its
  // stored sort unchanged is read as "leave it where it is", and takes the
  // sort a shift gave it; writing its old sort back would tie it with the
  // passage the shift made room for. A caller that means to set an absolute
  // sort equal to the stored one cannot express that here.
  let shiftedSorts = new Map<string, number>();
  if (sortedNewPassages.length && existingUuidSet.size) {
    const sorts = await getPassageSorts({
      client,
      uuids: [...existingUuidSet],
    });
    if (!sorts) {
      return failure('Failed to read shifted passage sorts');
    }
    shiftedSorts = sorts;
  }
  const sortBefore = new Map(
    (existingRows ?? []).map((row) => [row.uuid, row.sort]),
  );
  const toSave = passages.map((passage) => {
    const placed = placedSorts.get(passage.uuid);
    if (placed !== undefined) return { ...passage, sort: placed };
    const shifted = shiftedSorts.get(passage.uuid);
    return shifted !== undefined &&
      passage.sort === sortBefore.get(passage.uuid)
      ? { ...passage, sort: shifted }
      : passage;
  });

  // Compute row/annotation diffs against the pre-save state before any
  // content writes happen.
  const dtos = passagesToDTO(toSave);
  const passageRowDtos = passagesToRowDTO(toSave);
  const passageUuids = passages.map((p) => p.uuid);
  const annotations = dtos.flatMap((p) => p.annotations || []);
  const { data: existingAnnotations } =
    passageUuids.length > 0
      ? await client
          .from('passage_annotations')
          .select('uuid, passage_uuid, start, end, type, content, toh')
          .in('passage_uuid', passageUuids)
          .not('type', 'in', `(${ANNOTATIONS_TO_IGNORE.join(',')})`)
      : { data: [] };

  const existingRowsByUuid = new Map(
    ((existingRows ?? []) as ExistingPassageRow[]).map((row) => [
      row.uuid,
      { ...row, sort: shiftedSorts.get(row.uuid) ?? row.sort },
    ]),
  );
  const passageRowsToUpsert = passageRowDtos.filter((row) =>
    passageRowHasChanged(row, existingRowsByUuid.get(row.uuid)),
  );
  const existingAnnotationsByUuid = new Map(
    ((existingAnnotations ?? []) as ExistingAnnotationRow[]).map(
      (annotation) => [annotation.uuid, annotation],
    ),
  );
  const annotationsToUpsert = annotations.filter((annotation) =>
    annotationHasChanged(
      annotation,
      existingAnnotationsByUuid.get(annotation.uuid),
    ),
  );

  // A passage whose annotation set is incomplete (serialization gap on the
  // client) must not have its stored annotations treated as deletions —
  // deleting them would turn a transient export failure into permanent data
  // loss. They are cleaned up by the next complete export.
  const incompletePassageUuids = new Set(
    passages
      .filter((passage) => passage.annotationsIncomplete)
      .map((passage) => passage.uuid),
  );
  const annotationsToDelete = existingAnnotations?.filter(
    (existingAnnotation) =>
      !incompletePassageUuids.has(existingAnnotation.passage_uuid) &&
      !annotations.find(
        (annotation) => annotation.uuid === existingAnnotation.uuid,
      ),
  );

  // Core content commits first — everything after this point is cosmetic
  // renumbering or cleanup.
  if (passageRowsToUpsert.length > 0) {
    const { error: passageError } = await client
      .from('passages')
      .upsert(passageRowsToUpsert, { onConflict: 'uuid' });

    if (passageError) {
      console.error('Error saving passages:', passageError);
      return failure(`Failed to save passages: ${passageError.message}`);
    }
  }

  if (annotationsToUpsert.length > 0) {
    const { error: annotationError } = await client
      .from('passage_annotations')
      .upsert(annotationsToUpsert, { onConflict: 'uuid' });

    if (annotationError) {
      console.error('Error saving annotations:', annotationError);
      return failure(
        `Passages saved but annotations failed: ${annotationError.message}`,
        passages.length,
      );
    }
  }

  // Renumber neighbors of inserted passages now that the content is safe.
  const renumberedByUuid = new Map<string, string>();
  const clientRenumberedUuids = new Set(inputUuids);
  const placedSort = (passage: Passage) =>
    placedSorts.get(passage.uuid) ?? passage.sort;
  const renumberOrder = [...newPassages].sort(
    (a, b) => placedSort(b) - placedSort(a),
  );
  for (const passage of renumberOrder) {
    const { error, renumbered } = await normalizePassageLabelsAfter({
      client,
      workUuid: passage.workUuid,
      fromSort: placedSort(passage),
      fromLabel: passage.label,
      delta: 1,
      clientRenumberedUuids,
    });
    renumbered.forEach((row) => renumberedByUuid.set(row.uuid, row.label));
    if (error) {
      return failure(
        `Content saved but passage labels were not renumbered: ${error}`,
        passages.length,
      );
    }
  }

  let deletedCount = 0;
  if (deletedUuids.length > 0) {
    const { data: deletedPassages, error: deletedFetchError } = await client
      .from('passages')
      .select('uuid, sort, label, work_uuid')
      .in('uuid', deletedUuids);

    if (deletedFetchError) {
      console.error(
        'Error fetching passages marked for deletion:',
        deletedFetchError,
      );
      return failure(
        `Failed to fetch passages marked for deletion: ${deletedFetchError.message}`,
        passages.length,
      );
    }

    if (deletedPassages && deletedPassages.length > 0) {
      const sortedDeleted = [...deletedPassages].sort(
        (a, b) => b.sort - a.sort,
      );

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
        return failure(
          `Failed to delete annotations for deleted passages: ${deleteAnnotationsError.message}`,
          passages.length,
        );
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
          return failure(
            `Failed to find endnote-link references to deleted passage: ${findReferencesError.message}`,
            passages.length,
          );
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
            return failure(
              `Failed to delete endnote-link references to deleted passage: ${deleteReferencesError.message}`,
              passages.length,
            );
          }
        }
      }

      const { error: deletePassagesError } = await client
        .from('passages')
        .delete()
        .in('uuid', deletedUuids);

      if (deletePassagesError) {
        console.error('Error deleting passages:', deletePassagesError);
        return failure(
          `Failed to delete passages: ${deletePassagesError.message}`,
          passages.length,
        );
      }

      deletedCount = deletedPassages.length;

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
        renumbered.forEach((row) => renumberedByUuid.set(row.uuid, row.label));
        if (error) {
          return failure(
            `Passages deleted but labels were not renumbered: ${error}`,
            passages.length,
          );
        }
      }
    }
  }

  // Stale rows left behind here resurrect deleted markup on the next load,
  // so a failure must reach the client even though the content upserts
  // already committed.
  if (annotationsToDelete && annotationsToDelete.length > 0) {
    const { error: deleteError } = await client
      .from('passage_annotations')
      .delete()
      .in(
        'uuid',
        annotationsToDelete.map((annotation) => annotation.uuid),
      );

    if (deleteError) {
      console.error('Error deleting annotations:', deleteError);
      return failure(
        `Passages saved but stale annotations could not be removed: ${deleteError.message}`,
        passages.length,
      );
    }
  }

  const { data: savedRows } =
    inputUuids.length > 0
      ? await client
          .from('passages')
          .select('uuid, work_uuid, content, label, sort, type, xmlId, toh')
          .in('uuid', inputUuids)
      : { data: [] };

  const savedPassages: SavedPassageRow[] = (savedRows ?? []).map((row) => ({
    uuid: row.uuid,
    workUuid: row.work_uuid,
    content: row.content,
    label: row.label ?? '',
    sort: row.sort,
    type: row.type as BodyItemType,
    xmlId: row.xmlId ?? null,
    toh: (row.toh as TohokuCatalogEntry) ?? null,
  }));

  // Rows returned in `passages` already carry their final label, so reporting
  // them again as renumbered would be redundant.
  const savedUuidSet = new Set(savedPassages.map((row) => row.uuid));
  const renumberedPassages: RenumberedPassageRow[] = Array.from(
    renumberedByUuid.entries(),
  )
    .filter(([uuid]) => !savedUuidSet.has(uuid))
    .map(([uuid, label]) => ({ uuid, label }));

  return {
    success: true,
    savedCount: passages.length,
    deletedCount,
    passages: savedPassages,
    renumberedPassages,
  };
};
