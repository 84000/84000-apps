import type { DataClient, Passage, PassageRowDTO } from '../../types';
import { getPassageSorts } from '../read';
import type { StepError } from './types';

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
 * Make room for new passages before their rows are inserted, and return the
 * sorts the save assigned. Anchored placement applies only when `insertAfter`
 * covers every new passage; otherwise each shifts at its own sort, highest
 * first, and keeps it.
 */
export const makeRoomForNewPassages = async ({
  client,
  newPassages,
  insertAfter,
}: {
  client: DataClient;
  newPassages: Passage[];
  insertAfter?: Record<string, string | null>;
}): Promise<{ placedSorts: Map<string, number> } | StepError> => {
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
    if ('error' in placed) return placed;
    return { placedSorts: placed.sorts };
  }

  const highestFirst = [...newPassages].sort((a, b) => b.sort - a.sort);
  for (const passage of highestFirst) {
    const { error } = await client.rpc('shift_passage_sorts', {
      p_work_uuid: passage.workUuid,
      p_from_sort: passage.sort,
      p_delta: 1,
    });
    if (error) {
      console.error('Error shifting passage sorts:', error);
      return { error: `Failed to shift passage sorts: ${error.message}` };
    }
  }
  return { placedSorts: new Map() };
};

/**
 * The passages with the sorts to save them at, and the stored sorts of the
 * existing ones after any shift.
 *
 * `existingRows` predates the shifts. An existing passage sent with its
 * stored sort unchanged is read as "leave it where it is", and takes the
 * sort a shift gave it; writing its old sort back would tie it with the
 * passage the shift made room for. A caller that means to set an absolute
 * sort equal to the stored one cannot express that here.
 */
export const sortsAfterShift = async ({
  client,
  passages,
  existingRows,
  placedSorts,
  shifted,
}: {
  client: DataClient;
  passages: Passage[];
  existingRows: PassageRowDTO[];
  placedSorts: Map<string, number>;
  /** Whether any shift ran, so existing sorts may have moved. */
  shifted: boolean;
}): Promise<
  { toSave: Passage[]; shiftedSorts: Map<string, number> } | StepError
> => {
  let shiftedSorts = new Map<string, number>();
  if (shifted && existingRows.length) {
    const sorts = await getPassageSorts({
      client,
      uuids: existingRows.map((row) => row.uuid),
    });
    if (!sorts) {
      return { error: 'Failed to read shifted passage sorts' };
    }
    shiftedSorts = sorts;
  }
  const sortBefore = new Map(existingRows.map((row) => [row.uuid, row.sort]));
  const toSave = passages.map((passage) => {
    const placed = placedSorts.get(passage.uuid);
    if (placed !== undefined) return { ...passage, sort: placed };
    const shiftedSort = shiftedSorts.get(passage.uuid);
    return shiftedSort !== undefined &&
      passage.sort === sortBefore.get(passage.uuid)
      ? { ...passage, sort: shiftedSort }
      : passage;
  });
  return { toSave, shiftedSorts };
};
