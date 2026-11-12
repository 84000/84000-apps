import { applyPassageEdits } from '../passage/edits';
import { inBatches } from '../passage/in-batches';
import type { DataClient, Passage } from '../types';

/** The most instances one call removes. */
export const MAX_GLOSSARY_INSTANCE_REMOVALS = 100;

/** How many passages are saved at once. */
const CONCURRENT_PASSAGES = 4;

/** A passage whose instances could not be removed. */
export type GlossaryInstanceRemovalFailure = {
  passageUuid: string;
  passageLabel: string | null;
  /** The instances asked for in it, none of which were removed. */
  annotationUuids: string[];
  error: string;
};

/** What a removal did, passage by passage. */
export type RemoveGlossaryTermInstancesResult = {
  /** Instances removed, or already gone. */
  removed: string[];
  /** Passages whose instances stay, with the reason. */
  failed: GlossaryInstanceRemovalFailure[];
  /** The passages as saved, for an open editor to take in. */
  passages: Passage[];
  /** Set when nothing was attempted. */
  error?: string;
};

type StoredInstance = {
  uuid: string;
  passage_uuid: string;
  type: string;
  content: unknown;
};

const citesTerm = (content: unknown, termUuid: string) =>
  Array.isArray(content) &&
  content.some(
    (item) =>
      !!item &&
      typeof item === 'object' &&
      (item as { uuid?: unknown }).uuid === termUuid,
  );

/**
 * Remove glossary-instance annotations of one entry, leaving the passage text
 * as it is. Each passage is saved on its own through the passage write path,
 * so a failure keeps that passage's instances and the other passages'
 * removals stand. Every uuid must name an instance citing `termUuid` in the
 * work; one that doesn't fails its passage.
 */
export const removeGlossaryTermInstances = async ({
  client,
  workUuid,
  termUuid,
  annotationUuids,
}: {
  client: DataClient;
  workUuid: string;
  termUuid: string;
  annotationUuids: string[];
}): Promise<RemoveGlossaryTermInstancesResult> => {
  const nothing = (error: string) => ({
    removed: [],
    failed: [],
    passages: [],
    error,
  });
  const uuids = [...new Set(annotationUuids)];
  if (uuids.length === 0) return nothing('No instances to remove');
  if (uuids.length > MAX_GLOSSARY_INSTANCE_REMOVALS) {
    return nothing(
      `At most ${MAX_GLOSSARY_INSTANCE_REMOVALS} instances can be removed at once`,
    );
  }

  const stored = new Map<string, StoredInstance>();
  for (const batch of inBatches(uuids)) {
    const { data, error } = await client
      .from('passage_annotations')
      .select('uuid, passage_uuid, type, content')
      .in('uuid', batch);
    if (error) {
      console.error('Error reading glossary instances to remove:', error);
      return nothing(`Failed to read the instances: ${error.message}`);
    }
    for (const row of (data ?? []) as unknown as StoredInstance[]) {
      stored.set(row.uuid, row);
    }
  }

  // Passages of the work, with their labels; one missing is in another work.
  const labels = new Map<string, string | null>();
  const passageUuids = [
    ...new Set([...stored.values()].map((row) => row.passage_uuid)),
  ];
  for (const batch of inBatches(passageUuids)) {
    const { data, error } = await client
      .from('passages')
      .select('uuid, label')
      .eq('work_uuid', workUuid)
      .in('uuid', batch);
    if (error) {
      console.error('Error reading passages of glossary instances:', error);
      return nothing(`Failed to read the passages: ${error.message}`);
    }
    for (const row of (data ?? []) as {
      uuid: string;
      label: string | null;
    }[]) {
      labels.set(row.uuid, row.label);
    }
  }

  const failed: GlossaryInstanceRemovalFailure[] = [];
  // One already gone, such as from another tab, needs no removing.
  const removed = uuids.filter((uuid) => !stored.has(uuid));

  const byPassage = new Map<string, StoredInstance[]>();
  for (const row of stored.values()) {
    const list = byPassage.get(row.passage_uuid) ?? [];
    list.push(row);
    byPassage.set(row.passage_uuid, list);
  }

  const passages: Passage[] = [];
  const removeFrom = async (passageUuid: string, rows: StoredInstance[]) => {
    const fail = (error: string) =>
      failed.push({
        passageUuid,
        passageLabel: labels.get(passageUuid) ?? null,
        annotationUuids: rows.map((row) => row.uuid),
        error,
      });
    const stray = rows.find(
      (row) =>
        row.type !== 'glossary-instance' ||
        !citesTerm(row.content, termUuid) ||
        !labels.has(passageUuid),
    );
    if (stray) {
      return fail(`${stray.uuid} is not an instance of this entry in the work`);
    }

    try {
      const result = await applyPassageEdits({
        client,
        workUuid,
        edits: rows.map((row) => ({
          op: 'remove-annotation' as const,
          passageUuid,
          annotationUuid: row.uuid,
        })),
      });
      if (result.applied === true) {
        removed.push(...rows.map((row) => row.uuid));
        passages.push(...result.passages);
      } else if (result.applied === 'unknown') {
        fail(`The save may have been applied: ${result.error ?? 'no answer'}`);
      } else {
        fail(result.error ?? 'The passage could not be saved');
      }
    } catch (error) {
      console.error('Unexpected error removing glossary instances:', error);
      fail(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  const queue = [...byPassage.entries()];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      await removeFrom(...next);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENT_PASSAGES, queue.length) }, worker),
  );

  return { removed, failed, passages };
};
