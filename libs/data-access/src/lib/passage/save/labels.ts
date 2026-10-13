import type { DataClient, Passage } from '../../types';
import type { StepError } from './types';

/** Below PostgREST's row cap, so a short page always means the last one. */
const PAGE_SIZE = 500;

/** One passage of a work, as label renumbering sees it. */
export type LabelRow = {
  uuid: string;
  sort: number;
  label: string;
  toh: unknown;
};

/**
 * Every labelled passage of a work, in order, for planning label renumbering.
 * Unlabelled passages hold no slot and have no children.
 */
export const readLabelIndex = async (
  client: DataClient,
  workUuid: string,
): Promise<{ data: LabelRow[] } | StepError> => {
  const rows: LabelRow[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, sort, label, toh')
      .eq('work_uuid', workUuid)
      .not('label', 'is', null)
      .neq('label', '')
      .order('sort', { ascending: true })
      .order('uuid', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('Error reading passage labels:', error);
      return { error: `Failed to read passage labels: ${error.message}` };
    }
    (data ?? []).forEach((row) =>
      rows.push({
        uuid: row.uuid as string,
        sort: row.sort as number,
        label: (row.label as string | null) ?? '',
        toh: row.toh ?? null,
      }),
    );
    if ((data?.length ?? 0) < PAGE_SIZE) return { data: rows };
  }
};

const byPosition = (a: LabelRow, b: LabelRow) =>
  a.sort - b.sort || a.uuid.localeCompare(b.uuid);

/**
 * Renumber a series in `rows` after a passage was inserted into it (`delta`
 * 1) or removed from it (`delta` -1), from `fromSort` on. Changes `rows`, in
 * position order, in place: the walked labels, and the labels of each walked
 * passage's own children, renamed from the labels as they stood before the
 * walk so one rename never feeds another.
 */
export const renumberAfter = (
  rows: LabelRow[],
  {
    fromSort,
    fromLabel,
    delta,
    clientRenumberedUuids,
  }: {
    fromSort: number;
    fromLabel: string;
    delta: 1 | -1;
    /**
     * Passages in this save's payload. The editor renumbers the passages it
     * has loaded before saving, so a row here already holding its expected
     * label does not mean the rest of the series is correct.
     */
    clientRenumberedUuids: Set<string>;
  },
): void => {
  const parts = fromLabel.split('.');
  const depth = parts.length;
  const prefix = depth > 1 ? `${parts.slice(0, -1).join('.')}.` : '';
  const last = Number.parseInt(parts[depth - 1], 10);
  if (!Number.isInteger(last)) return;
  let nextInt = last + Math.max(delta, 0);

  // A label is a slot, not a row: per-text variants of one note share a
  // label and are told apart by a non-null `toh`, and all move to the same
  // new number. A row without `toh` always stands alone in its slot.
  let previousLabel: string | undefined;
  let previousToh: unknown = null;
  let previousAssignedLabel: string | undefined;

  const relabelled = new Map<string, string>();

  for (const row of rows) {
    if (row.sort <= fromSort) continue;
    // An unlabelled passage holds no slot in the series.
    if (!row.label) continue;

    const rowParts = row.label.split('.');
    if (rowParts.length < depth || !row.label.startsWith(prefix)) break;
    if (rowParts.length > depth) continue;

    const isSameSlot =
      previousLabel !== undefined &&
      row.label === previousLabel &&
      row.toh !== null &&
      previousToh !== null;
    const expectedLabel = isSameSlot
      ? (previousAssignedLabel as string)
      : prefix + nextInt;

    if (!isSameSlot && row.label === expectedLabel) {
      // The tail is contiguous, unless the client renumbered this row itself
      // and the rows past its window are still stale.
      if (!clientRenumberedUuids.has(row.uuid)) break;
    } else if (row.label !== expectedLabel) {
      relabelled.set(row.uuid, expectedLabel);
    }

    previousLabel = row.label;
    previousToh = row.toh;
    previousAssignedLabel = expectedLabel;
    if (!isSameSlot) nextInt++;
  }

  // A passage's children are the passages after it, in the same Toh, whose
  // labels carry its label as a prefix; the first one that does not ends
  // them. Passages of another Toh, which may share its labels, are passed
  // over.
  const before = rows.map((row) => row.label);
  const otherToh = (a: unknown, b: unknown) =>
    a !== null && b !== null && a !== b;
  const renamed = new Map<number, string>();
  rows.forEach((row, at) => {
    const label = relabelled.get(row.uuid);
    if (label === undefined) return;
    renamed.set(at, label);
    const oldPrefix = `${before[at]}.`;
    for (let next = at + 1; next < rows.length; next++) {
      const child = rows[next];
      if (!before[next] || otherToh(child.toh, row.toh)) continue;
      // The client already moved this child with its parent.
      if (
        clientRenumberedUuids.has(child.uuid) &&
        before[next].startsWith(`${label}.`)
      ) {
        continue;
      }
      if (!before[next].startsWith(oldPrefix)) break;
      renamed.set(next, `${label}.${before[next].slice(oldPrefix.length)}`);
    }
  });
  renamed.forEach((label, at) => (rows[at].label = label));
};

/**
 * Whether a per-text variant of `row`'s slot survives the delete: a row of
 * another Toh holding the same stored label, next to `row` in position with
 * only deeper or unlabelled rows between them. A namesake further off is
 * another slot.
 */
const variantRemains = (
  rows: LabelRow[],
  row: LabelRow,
  storedLabels: Map<string, string>,
  deletedUuids: Set<string>,
): boolean => {
  const stored = storedLabels.get(row.uuid);
  if (stored === undefined) return false;
  const depth = stored.split('.').length;
  const at = rows.indexOf(row);
  for (const step of [-1, 1]) {
    for (let next = at + step; next >= 0 && next < rows.length; next += step) {
      const other = rows[next];
      const label = storedLabels.get(other.uuid) ?? other.label;
      if (!label || label.split('.').length > depth) continue;
      if (label !== stored || other.toh === null) break;
      if (!deletedUuids.has(other.uuid)) return true;
    }
  }
  return false;
};

/** The labels a save changes. */
export type LabelPlan = {
  /** Every passage left whose label changes, with its final label. */
  final: Map<string, string>;
};

/**
 * The labels a save leaves on a work's passages: `index` holds the work as it
 * will stand once written, new passages included. Each insert renumbers the
 * series after it, highest first, while the deleted passages are still there;
 * then the deleted passages are taken out and the series after each is
 * renumbered, highest first.
 */
export const planLabels = ({
  index,
  inserts,
  deletedUuids,
  clientRenumberedUuids,
  storedLabels = new Map(index.map((row) => [row.uuid, row.label])),
}: {
  index: LabelRow[];
  /** The new passages, at the sorts the save placed them. */
  inserts: { sort: number; label: string }[];
  deletedUuids: Set<string>;
  clientRenumberedUuids: Set<string>;
  /**
   * Labels as stored, before the client's own renumbering, to tell a
   * per-text variant from a slot the client moved onto the same label.
   * Defaults to the labels in `index`.
   */
  storedLabels?: Map<string, string>;
}): LabelPlan => {
  const rows = index.map((row) => ({ ...row })).sort(byPosition);
  const before = new Map(rows.map((row) => [row.uuid, row.label]));
  const changedSince = (labels: Map<string, string>, list: LabelRow[]) =>
    new Map(
      list
        .filter((row) => row.label !== labels.get(row.uuid))
        .map((row) => [row.uuid, row.label]),
    );

  [...inserts]
    .filter((insert) => insert.label)
    .sort((a, b) => b.sort - a.sort)
    .forEach((insert) =>
      renumberAfter(rows, {
        fromSort: insert.sort,
        fromLabel: insert.label,
        delta: 1,
        clientRenumberedUuids,
      }),
    );

  const deleted = rows
    .filter((row) => deletedUuids.has(row.uuid))
    .sort((a, b) => b.sort - a.sort);
  const remaining = rows.filter((row) => !deletedUuids.has(row.uuid));
  deleted
    .filter((row) => row.label)
    // Another per-text variant still holds the slot, so nothing moves up.
    .filter(
      (row) =>
        row.toh === null ||
        !variantRemains(rows, row, storedLabels, deletedUuids),
    )
    .forEach((row) =>
      renumberAfter(remaining, {
        fromSort: row.sort,
        fromLabel: row.label,
        delta: -1,
        clientRenumberedUuids,
      }),
    );

  return { final: changedSince(before, remaining) };
};

/**
 * The labels a save changes, on its own passages and on the rest of their
 * series. `toSave` holds the saved passages at their final sorts; only works
 * where a labelled passage is inserted or deleted are read.
 */
export const planSaveLabels = async ({
  client,
  toSave,
  newUuids,
  deleted,
}: {
  client: DataClient;
  toSave: Passage[];
  newUuids: Set<string>;
  deleted: { uuid: string; label: string; work_uuid: string }[];
}): Promise<{ data: LabelPlan } | StepError> => {
  const works = new Set([
    ...toSave
      .filter((passage) => newUuids.has(passage.uuid) && passage.label)
      .map((passage) => passage.workUuid),
    ...deleted.filter((row) => row.label).map((row) => row.work_uuid),
  ]);
  const clientRenumberedUuids = new Set(toSave.map((passage) => passage.uuid));
  const plan: LabelPlan = { final: new Map() };

  for (const workUuid of works) {
    const read = await readLabelIndex(client, workUuid);
    if ('error' in read) return read;
    const index = new Map(read.data.map((row) => [row.uuid, row]));
    const storedLabels = new Map(read.data.map((row) => [row.uuid, row.label]));
    const inWork = toSave.filter((passage) => passage.workUuid === workUuid);
    inWork.forEach((passage) =>
      index.set(passage.uuid, {
        uuid: passage.uuid,
        sort: passage.sort,
        label: passage.label ?? '',
        toh: passage.toh ?? index.get(passage.uuid)?.toh ?? null,
      }),
    );
    const work = planLabels({
      index: [...index.values()],
      inserts: inWork.filter((passage) => newUuids.has(passage.uuid)),
      deletedUuids: new Set(
        deleted
          .filter((row) => row.work_uuid === workUuid)
          .map((row) => row.uuid),
      ),
      clientRenumberedUuids,
      storedLabels,
    });
    work.final.forEach((label, uuid) => plan.final.set(uuid, label));
  }
  return { data: plan };
};
