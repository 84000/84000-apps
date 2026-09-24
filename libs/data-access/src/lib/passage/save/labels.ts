import type { DataClient } from '../../types';
import type { RenumberedPassageRow } from './types';

const SAVE_PAGE_SIZE = 500;

/**
 * Renumber the labels of a series after a passage was inserted into it
 * (`delta` 1) or removed from it (`delta` -1), from `fromSort` on.
 */
export async function normalizePassageLabelsAfter({
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
