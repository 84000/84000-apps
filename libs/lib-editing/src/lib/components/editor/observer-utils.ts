import { XmlElement, XmlFragment, YEvent } from 'yjs';

export interface FragmentBaseline {
  uuids: Set<string>;
  length: number;
}

export const collectPassageUuids = (fragment: XmlFragment): Set<string> => {
  const uuids = new Set<string>();
  for (let i = 0; i < fragment.length; i++) {
    const child = fragment.get(i);
    if (child instanceof XmlElement && child.nodeName === 'passage') {
      const uuid = child.getAttribute('uuid');
      if (uuid) {
        uuids.add(uuid);
      }
    }
  }
  return uuids;
};

export const captureFragmentBaseline = (
  fragment: XmlFragment,
): FragmentBaseline => ({
  uuids: collectPassageUuids(fragment),
  length: fragment.length,
});

/**
 * Walks up from the first event's target to the observed XmlFragment. Merge
 * operations may only produce events targeting passage-level XmlElements
 * (not the fragment itself), so the fragment must be found by ancestry
 * rather than by checking each event's target.
 */
export const findObservedFragment = (
  events: YEvent<XmlFragment | XmlElement>[],
): XmlFragment | null => {
  let current: XmlFragment | XmlElement | null = events[0]?.target ?? null;
  while (current) {
    if (current instanceof XmlFragment && !(current instanceof XmlElement)) {
      return current;
    }
    current = current.parent as XmlFragment | XmlElement | null;
  }
  return null;
};

/**
 * Cheap per-transaction gate for the O(passages) fragment scan. Plain typing
 * produces events targeting nested XmlText/XmlElement nodes with the
 * fragment length unchanged — no scan. Structural changes either change the
 * top-level child count or produce an event on the fragment itself with
 * add/delete deltas (the equal-length replace case), so a false negative is
 * impossible for them; a false positive just runs one scan that finds
 * nothing. `event.changes` is computed lazily by Yjs, so it is only touched
 * for events targeting the fragment itself.
 *
 * Known benign gap: a uuid-attribute-only change (e.g. EnsureUniqueUuids
 * re-stamping a duplicate) no longer refreshes the baseline immediately. The
 * txn.changed walk still dirties the new uuid, save payloads derive from the
 * per-editor ProseMirror baselines rather than this map, and the next
 * structural scan reconciles the stale entry.
 */
export const shouldRescanFragment = (
  events: YEvent<XmlFragment | XmlElement>[],
  fragment: XmlFragment,
  baseline: FragmentBaseline | undefined,
): boolean => {
  if (!baseline) {
    return true;
  }
  if (fragment.length !== baseline.length) {
    return true;
  }
  return events.some(
    (event) =>
      event.target === fragment &&
      (event.changes.added.size > 0 || event.changes.deleted.size > 0),
  );
};

export const diffPassageUuids = (
  previous: Set<string>,
  live: Set<string>,
): { added: string[]; hasDeleted: boolean } => {
  const added: string[] = [];
  live.forEach((uuid) => {
    if (!previous.has(uuid)) {
      added.push(uuid);
    }
  });

  let hasDeleted = false;
  previous.forEach((uuid) => {
    if (!live.has(uuid)) {
      hasDeleted = true;
    }
  });

  return { added, hasDeleted };
};
