import type {
  CommentAnchor,
  PassageComments,
} from '@eightyfourthousand/client-graphql';
import type { CommentThread } from '@eightyfourthousand/data-access';

/** A thread as the panel lists it, with every place the text points at it. */
export interface PanelThread {
  thread: CommentThread;
  /**
   * Every anchor across the passages read, in document order. Empty for an
   * unanchored thread.
   */
  anchors: CommentAnchor[];
  /** The label of the passage holding the first anchor, for the list heading. */
  passageLabel?: string;
  /** That passage's type, which is what decides the panel and tab it is read in. */
  passageType?: string;
}

/**
 * Folds anchors that sit end to end into one.
 *
 * A mark spanning other inline marks is stored as one annotation per text run,
 * so a comment over a sentence carrying glossary terms arrives as several
 * adjacent ranges. They are one place in the text and the panel should say so.
 */
export const mergeContiguous = (anchors: CommentAnchor[]): CommentAnchor[] => {
  const inOrder = [...anchors].sort(
    (a, b) => a.passageUuid.localeCompare(b.passageUuid) || a.start - b.start,
  );

  return inOrder.reduce<CommentAnchor[]>((merged, anchor) => {
    const last = merged[merged.length - 1];

    if (last?.passageUuid === anchor.passageUuid && last.end === anchor.start) {
      merged[merged.length - 1] = { ...last, end: anchor.end };
      return merged;
    }

    return [...merged, anchor];
  }, []);
};

/**
 * The panel's two lists: threads the text places, in the order the text places
 * them, and threads nothing places any more.
 *
 * Keyed by thread rather than by passage, because a thread is one discussion
 * however many anchors carry it — a selection crossing a passage boundary is
 * stored as one row per passage, and a split inside a commented range mints
 * another. Listing per passage would show the same thread twice.
 *
 * Position is the first anchor: earliest passage, then earliest offset. Not
 * `createdAt` — the panel reads as a margin, so it follows the text.
 */
export const orderThreads = (
  passages: PassageComments[],
): { anchored: PanelThread[]; unanchored: PanelThread[] } => {
  const anchored = new Map<string, PanelThread>();
  const unanchored = new Map<string, PanelThread>();

  const inWorkOrder = [...passages].sort((a, b) => a.sort - b.sort);

  for (const passage of inWorkOrder) {
    const byPosition = [...passage.anchored].sort(
      (a, b) => (a.anchors[0]?.start ?? 0) - (b.anchors[0]?.start ?? 0),
    );

    for (const { thread, anchors } of byPosition) {
      const existing = anchored.get(thread.uuid);
      if (existing) {
        existing.anchors.push(...anchors);
      } else {
        anchored.set(thread.uuid, {
          thread,
          anchors: [...anchors],
          passageLabel: passage.label,
          passageType: passage.type,
        });
      }
    }

    for (const thread of passage.unanchored) {
      if (!unanchored.has(thread.uuid)) {
        // The passage is the one the thread was born on, which is the only
        // place it can be read from once nothing anchors it.
        unanchored.set(thread.uuid, {
          thread,
          anchors: [],
          passageLabel: passage.label,
          passageType: passage.type,
        });
      }
    }
  }

  // A thread reported unanchored by one passage but anchored in another is
  // anchored: scope is per passage, and only the absence of every anchor makes
  // a thread unanchored.
  for (const uuid of anchored.keys()) {
    unanchored.delete(uuid);
  }

  for (const entry of anchored.values()) {
    entry.anchors = mergeContiguous(entry.anchors);
  }

  return {
    anchored: [...anchored.values()],
    unanchored: [...unanchored.values()].sort((a, b) =>
      a.thread.createdAt.localeCompare(b.thread.createdAt),
    ),
  };
};
