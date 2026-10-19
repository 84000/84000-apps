import { v5 as uuidv5 } from 'uuid';
import type { AnnotationDTO } from '../types';
import { stableStringify } from './save/diff';

/**
 * The fixed namespace every derived 84000 uuid is minted under. Never change
 * it: rows already saved under it would stop matching their inputs.
 */
export const UUID_NAMESPACE_84000 = '77a2230f-d349-43af-bd7d-c24d3bbadf11';

/** A UUIDv5 of `kind` and `parts`, the same for the same inputs. */
export const derivedUuid = (kind: string, ...parts: (string | number)[]) =>
  uuidv5(JSON.stringify([kind, ...parts]), UUID_NAMESPACE_84000);

/**
 * The uuid an imported passage gets when it arrives without one: its work and
 * its import key (the xmlId it is saved with). A repeated key within one
 * import passes its occurrence, from 2, to keep the uuids apart.
 */
export const importPassageUuid = (
  workUuid: string,
  key: string,
  occurrence = 1,
) =>
  occurrence > 1
    ? derivedUuid('passage', workUuid, key, occurrence)
    : derivedUuid('passage', workUuid, key);

/**
 * The uuid a new annotation row gets: its passage, type, range and content.
 * An identical row repeated on one passage passes its occurrence, from 2.
 */
export const derivedAnnotationUuid = (
  passageUuid: string,
  row: Pick<AnnotationDTO, 'type' | 'start' | 'end' | 'content' | 'toh'>,
  occurrence = 1,
) => {
  const parts = [
    passageUuid,
    row.type,
    row.start,
    row.end,
    stableStringify([row.content ?? [], row.toh ?? null]),
  ];
  return occurrence > 1
    ? derivedUuid('annotation', ...parts, occurrence)
    : derivedUuid('annotation', ...parts);
};

/**
 * Counts each key as it is seen, so the n-th repeat of a key can be told
 * apart from the first.
 */
export const occurrenceCounter = () => {
  const seen = new Map<string, number>();
  return (key: string) => {
    const count = (seen.get(key) ?? 0) + 1;
    seen.set(key, count);
    return count;
  };
};

/**
 * Hands out derived uuids by key, never one in `taken` or one it has already
 * handed out: a request whose next occurrence is taken gets the one after.
 * `taken` holds the uuids a caller sent explicitly, so a derived row never
 * collides with a row sent under its uuid. Passing `sent` counts a row that
 * carries its own uuid toward the key's occurrences and returns that uuid.
 */
export const derivedUuidAllocator = (taken: Iterable<string> = []) => {
  const used = new Set(taken);
  const occurrence = occurrenceCounter();
  return (
    key: string,
    uuidFor: (occurrence: number) => string,
    sent?: string,
  ) => {
    if (sent) {
      occurrence(key);
      return sent;
    }
    let uuid = uuidFor(occurrence(key));
    while (used.has(uuid)) {
      uuid = uuidFor(occurrence(key));
    }
    used.add(uuid);
    return uuid;
  };
};
