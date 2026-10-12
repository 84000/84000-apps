import type { DataClient, Passage } from '../../types';
import type { StepError } from './types';

const PAGE_SIZE = 1000;

/** One passage of a work, as label renumbering sees it. */
export type LabelRow = {
  uuid: string;
  sort: number;
  label: string;
  toh: unknown;
};

/** Every passage of a work, in order, for planning label renumbering. */
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
 * 1) or removed from it (`delta` -1), from `fromSort` on. Changes `rows` in
 * place: the walked labels, and the labels of their children, renamed from
 * the labels as they stood before the walk so one rename never feeds another.
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
  const prefixRenames = new Map<string, string>();

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
      if (!isSameSlot) prefixRenames.set(`${row.label}.`, `${expectedLabel}.`);
    }

    previousLabel = row.label;
    previousToh = row.toh;
    previousAssignedLabel = expectedLabel;
    if (!isSameSlot) nextInt++;
  }

  // Every renamed prefix has the walk's depth, so a label matches at most one.
  const renameOf = (label: string) => {
    const labelParts = label.split('.');
    if (labelParts.length <= depth) return undefined;
    const oldPrefix = `${labelParts.slice(0, depth).join('.')}.`;
    const newPrefix = prefixRenames.get(oldPrefix);
    return newPrefix === undefined
      ? undefined
      : newPrefix + label.slice(oldPrefix.length);
  };
  for (const row of rows) {
    const label = relabelled.get(row.uuid) ?? renameOf(row.label);
    if (label !== undefined) row.label = label;
  }
};

/**
 * The labels a save leaves on a work's passages: `index` holds the work as it
 * will stand once written, new passages included. Each insert renumbers the
 * series after it, highest first, while the deleted passages are still there;
 * then the deleted passages are taken out and the series after each is
 * renumbered, highest first. Returns the passages whose label changes.
 */
export const planLabels = ({
  index,
  inserts,
  deletedUuids,
  clientRenumberedUuids,
}: {
  index: LabelRow[];
  /** The new passages, at the sorts the save placed them. */
  inserts: { sort: number; label: string }[];
  deletedUuids: Set<string>;
  clientRenumberedUuids: Set<string>;
}): Map<string, string> => {
  const rows = index.map((row) => ({ ...row })).sort(byPosition);
  const before = new Map(rows.map((row) => [row.uuid, row.label]));

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
    .forEach((row) =>
      renumberAfter(remaining, {
        fromSort: row.sort,
        fromLabel: row.label,
        delta: -1,
        clientRenumberedUuids,
      }),
    );

  const changed = new Map<string, string>();
  remaining.forEach((row) => {
    if (row.label !== before.get(row.uuid)) changed.set(row.uuid, row.label);
  });
  return changed;
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
}): Promise<{ data: Map<string, string> } | StepError> => {
  const works = new Set([
    ...toSave
      .filter((passage) => newUuids.has(passage.uuid) && passage.label)
      .map((passage) => passage.workUuid),
    ...deleted.filter((row) => row.label).map((row) => row.work_uuid),
  ]);
  const clientRenumberedUuids = new Set(toSave.map((passage) => passage.uuid));
  const changed = new Map<string, string>();

  for (const workUuid of works) {
    const read = await readLabelIndex(client, workUuid);
    if ('error' in read) return read;
    const index = new Map(read.data.map((row) => [row.uuid, row]));
    const inWork = toSave.filter((passage) => passage.workUuid === workUuid);
    inWork.forEach((passage) =>
      index.set(passage.uuid, {
        uuid: passage.uuid,
        sort: passage.sort,
        label: passage.label ?? '',
        toh: passage.toh ?? index.get(passage.uuid)?.toh ?? null,
      }),
    );
    planLabels({
      index: [...index.values()],
      inserts: inWork.filter((passage) => newUuids.has(passage.uuid)),
      deletedUuids: new Set(
        deleted
          .filter((row) => row.work_uuid === workUuid)
          .map((row) => row.uuid),
      ),
      clientRenumberedUuids,
    }).forEach((label, uuid) => changed.set(uuid, label));
  }
  return { data: changed };
};
