import type { DataClient, Passage, PassageRowDTO } from '../../types';
import { getPassageSorts } from '../read';
import type { NewPassageAnchor, StepError } from './types';

/** Where a group of new passages goes: after a passage, before one, or neither. */
const groupKey = (passage: Passage, anchor: NewPassageAnchor | undefined) => {
  if (anchor && 'after' in anchor) return `after:${anchor.after}`;
  if (anchor && 'before' in anchor) return `before:${anchor.before}`;
  return `own:${passage.uuid}`;
};

type Group = { anchor: NewPassageAnchor; passages: Passage[] };

/**
 * Make room for new passages by the saved passage each sits next to, and
 * choose their sorts.
 *
 * A sort alone is ambiguous when several passages are created together: two
 * new passages after P, or one after P and one after its neighbour Q, can send
 * the same sorts. Grouping by the passage they follow (or, first in their
 * section, precede) is not. Groups are placed lowest first, each re-reading
 * its anchor because an earlier group's shift can move it, and never below
 * where the previous group ended, since anchors can share a sort.
 * `shift_passage_sorts` only checks that one slot is free, so room for a
 * group is made one slot at a time.
 */
const placeNewPassages = async ({
  client,
  passages,
  anchors,
}: {
  client: DataClient;
  passages: Passage[];
  anchors: Record<string, NewPassageAnchor>;
}): Promise<{ sorts: Map<string, number> } | { error: string }> => {
  const groups = new Map<string, Group>();
  passages.forEach((passage) => {
    const anchor = anchors[passage.uuid] ?? null;
    const key = groupKey(passage, anchor);
    const group = groups.get(key) ?? { anchor, passages: [] };
    group.passages.push(passage);
    groups.set(key, group);
  });
  // Within a group the client's sorts give the order; ties keep its order.
  groups.forEach((group) => group.passages.sort((a, b) => a.sort - b.sort));

  const anchorUuid = (anchor: NewPassageAnchor) =>
    anchor ? ('after' in anchor ? anchor.after : anchor.before) : null;

  /** The sort a group's first slot follows, given its anchor's sort. */
  const baseOf = (group: Group, sorts: Map<string, number>) => {
    const uuid = anchorUuid(group.anchor);
    const sort = uuid ? sorts.get(uuid) : undefined;
    if (sort !== undefined && group.anchor) {
      return 'after' in group.anchor ? sort : sort - 1;
    }
    // No anchor, or one that is not stored: take the place the client asked
    // for.
    return group.passages[0].sort - 1;
  };

  const rank = ({ anchor }: Group) =>
    anchor && 'after' in anchor ? 0 : anchor && 'before' in anchor ? 2 : 1;

  const readAnchors = (list: Group[]) =>
    getPassageSorts({
      client,
      uuids: list
        .map((group) => anchorUuid(group.anchor))
        .filter((uuid): uuid is string => !!uuid),
    });

  const initial = await readAnchors([...groups.values()]);
  if (!initial) return { error: 'Failed to read anchor passage sorts' };
  const order = [...groups.values()]
    .map((group) => ({ group, base: baseOf(group, initial) }))
    // At the same base, a group after a passage comes before one placed
    // before the next: the gap between them is where both belong.
    .sort((a, b) => a.base - b.base || rank(a.group) - rank(b.group));

  const sorts = new Map<string, number>();
  let placedTo = -Infinity;
  for (const [i, { group, base }] of order.entries()) {
    // An earlier group's shift may have moved this anchor.
    let at = base;
    if (i > 0 && anchorUuid(group.anchor)) {
      const current = await readAnchors([group]);
      if (!current) return { error: 'Failed to read anchor passage sorts' };
      at = baseOf(group, current);
    }
    at = Math.max(at, placedTo);
    for (let slot = at + 1; slot <= at + group.passages.length; slot++) {
      const { error } = await client.rpc('shift_passage_sorts', {
        p_work_uuid: group.passages[0].workUuid,
        p_from_sort: slot,
        p_delta: 1,
      });
      if (error) {
        console.error('Error shifting passage sorts:', error);
        return { error: `Failed to shift passage sorts: ${error.message}` };
      }
    }
    group.passages.forEach((passage, offset) =>
      sorts.set(passage.uuid, at + 1 + offset),
    );
    placedTo = at + group.passages.length;
  }
  return { sorts };
};

/**
 * Make room for new passages before their rows are inserted, and return the
 * sorts the save assigned. Anchored placement applies only when `anchors`
 * covers every new passage; otherwise each shifts at its own sort, highest
 * first, and keeps it.
 */
export const makeRoomForNewPassages = async ({
  client,
  newPassages,
  anchors,
}: {
  client: DataClient;
  newPassages: Passage[];
  anchors?: Record<string, NewPassageAnchor>;
}): Promise<{ placedSorts: Map<string, number> } | StepError> => {
  if (
    newPassages.length &&
    anchors &&
    newPassages.every((passage) => passage.uuid in anchors)
  ) {
    const placed = await placeNewPassages({
      client,
      passages: newPassages,
      anchors,
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
