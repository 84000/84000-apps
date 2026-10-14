import type { DataClient, GlossaryInstanceAnnotation } from '../types';
import { applyPassageEdits, type PassageEdit } from '../passage/edits';
import { citedUuid } from './match';
import { readGlossaryPassageState, type GlossaryPassageState } from './read';

/** One glossary instance to add, in stored offsets. */
export interface GlossaryInstanceItem {
  passageUuid: string;
  start: number;
  end: number;
  /** The text the range held when it was decided; a change makes the item stale. */
  text?: string;
  termUuid: string;
  authorityUuid: string;
}

/** What one chunk of the apply did. */
export interface GlossaryApplyChunk {
  passages: number;
  /** Items sent to the save. */
  instances: number;
  applied: boolean | 'unknown';
  error?: string;
  /** Uuids of the instances it created: what to remove to undo it. */
  annotationUuids: string[];
}

export interface GlossaryApplyResult {
  dryRun: boolean;
  chunks: GlossaryApplyChunk[];
  /** Instances created. */
  appliedInstances: number;
  /** Items already stored, with the same range and term; not sent. */
  alreadyApplied: number;
  /** Items whose passage is gone or whose text has changed; not sent. */
  staleInstances: number;
  /** Items overlapping a stored instance; not sent. */
  skippedInstances: number;
  /** Items in a chunk that failed (not written) or whose outcome is unknown. */
  failedInstances: number;
  /** Items not attempted: the time budget ran out, or a chunk stopped the apply. */
  remainingInstances: number;
  /** Why it stopped before the end, if it did. */
  stopped?: 'budget' | 'failed' | 'unknown' | 'read';
  warnings: string[];
}

export const DEFAULT_APPLY_CHUNK_PASSAGES = 100;
export const DEFAULT_APPLY_BUDGET_MS = 200_000;

const overlaps = (
  a: { start: number; end: number },
  b: { start: number; end: number },
) => a.start < b.end && b.start < a.end;

/**
 * Writes glossary instances through `applyPassageEdits`, a chunk of passages at a
 * time. Before each chunk it re-reads those passages and drops items whose text
 * has changed or that a stored instance already covers or overlaps, so a stale
 * plan never writes a wrong range. Each chunk is one atomic save. It stops at the
 * first chunk that fails or whose outcome is unknown, and when the time budget
 * (counted from `startedAt`) runs out. It never retries: after a stop, re-plan
 * before applying again.
 */
export const applyGlossaryInstances = async ({
  client,
  workUuid,
  items,
  termOf = new Map(),
  dryRun = false,
  chunkPassages = DEFAULT_APPLY_CHUNK_PASSAGES,
  budgetMs = DEFAULT_APPLY_BUDGET_MS,
  now = () => Date.now(),
  startedAt = now(),
  readState = (passageUuids) =>
    readGlossaryPassageState({ client, passageUuids }),
}: {
  client: DataClient;
  workUuid: string;
  items: GlossaryInstanceItem[];
  /** Glossary uuid a stored instance may cite, to its term. */
  termOf?: ReadonlyMap<string, string>;
  dryRun?: boolean;
  chunkPassages?: number;
  budgetMs?: number;
  now?: () => number;
  /** When the budget started, e.g. before planning. */
  startedAt?: number;
  readState?: (
    passageUuids: string[],
  ) => Promise<{ data: GlossaryPassageState } | { error: string }>;
}): Promise<GlossaryApplyResult> => {
  const byPassage = new Map<string, GlossaryInstanceItem[]>();
  for (const item of items) {
    const list = byPassage.get(item.passageUuid) ?? [];
    list.push(item);
    byPassage.set(item.passageUuid, list);
  }
  const passages = [...byPassage.keys()];
  const size = Math.max(1, Math.floor(chunkPassages));

  const result: GlossaryApplyResult = {
    dryRun,
    chunks: [],
    appliedInstances: 0,
    alreadyApplied: 0,
    staleInstances: 0,
    skippedInstances: 0,
    failedInstances: 0,
    remainingInstances: items.length,
    warnings: [],
  };

  for (let i = 0; i < passages.length; i += size) {
    if (now() - startedAt >= budgetMs) {
      result.stopped = 'budget';
      break;
    }
    const chunkPassageUuids = passages.slice(i, i + size);
    const chunkItems = chunkPassageUuids.flatMap((p) => byPassage.get(p) ?? []);

    const state = await readState(chunkPassageUuids);
    if ('error' in state) {
      result.stopped = 'read';
      result.warnings.push(`Could not re-read passages: ${state.error}`);
      break;
    }
    result.remainingInstances -= chunkItems.length;

    const stored = new Map<
      string,
      { start: number; end: number; term?: string }[]
    >();
    const existing = new Set<string>();
    for (const a of state.data.instances) {
      existing.add(a.uuid);
      const cited = citedUuid(a);
      const list = stored.get(a.passageUuid) ?? [];
      list.push({
        start: a.start,
        end: a.end,
        term: (cited && termOf.get(cited)) ?? cited,
      });
      stored.set(a.passageUuid, list);
    }

    const send: GlossaryInstanceItem[] = [];
    for (const item of chunkItems) {
      const content = state.data.content.get(item.passageUuid);
      if (
        content === undefined ||
        item.end > content.length ||
        (item.text !== undefined &&
          content.slice(item.start, item.end) !== item.text)
      ) {
        result.staleInstances++;
        continue;
      }
      const clash = (stored.get(item.passageUuid) ?? []).filter((s) =>
        overlaps(s, item),
      );
      if (
        clash.length === 1 &&
        clash[0].start === item.start &&
        clash[0].end === item.end &&
        clash[0].term === item.termUuid
      ) {
        result.alreadyApplied++;
      } else if (
        clash.length ||
        send.some(
          (s) => s.passageUuid === item.passageUuid && overlaps(s, item),
        )
      ) {
        result.skippedInstances++;
      } else {
        send.push(item);
      }
    }
    if (!send.length) continue;

    const edits: PassageEdit[] = send.map((item) => ({
      op: 'add-annotation',
      passageUuid: item.passageUuid,
      kind: 'glossary-instance',
      start: item.start,
      end: item.end,
      data: { glossary: item.termUuid, authority: item.authorityUuid },
    }));

    const saved = await applyPassageEdits({ client, workUuid, edits, dryRun });
    saved.warnings.forEach((w) => result.warnings.push(w.message));

    const expected = new Map(
      send.map((it) => [
        `${it.passageUuid}|${it.start}|${it.end}|${it.termUuid}`,
        it.text,
      ]),
    );
    const wanted = new Set(
      send.map(
        (it) => `${it.passageUuid}|${it.start}|${it.end}|${it.termUuid}`,
      ),
    );
    const annotationUuids = saved.passages.flatMap((p) =>
      p.annotations
        .filter(
          (a): a is GlossaryInstanceAnnotation =>
            a.type === 'glossaryInstance' &&
            wanted.has(
              `${p.uuid}|${a.start}|${a.end}|${(a as GlossaryInstanceAnnotation).glossary}`,
            ),
        )
        .filter((a) => !existing.has(a.uuid))
        .map((a) => {
          // The save reads the passage again; text that changed in between
          // is reported, since the instance now marks other words.
          const text = expected.get(
            `${p.uuid}|${a.start}|${a.end}|${a.glossary}`,
          );
          if (text !== undefined && p.content.slice(a.start, a.end) !== text) {
            result.warnings.push(
              `Instance ${a.uuid} in passage ${p.uuid} was written over text that changed during the apply; check it.`,
            );
          }
          return a.uuid;
        }),
    );

    const applied = dryRun ? false : saved.applied;
    result.chunks.push({
      passages: chunkPassageUuids.length,
      instances: send.length,
      applied,
      error: saved.error,
      annotationUuids: applied === true ? annotationUuids : [],
    });

    if (!saved.success) {
      result.stopped = saved.applied === 'unknown' ? 'unknown' : 'failed';
      result.failedInstances += send.length;
      break;
    }
    if (applied === true) {
      result.appliedInstances += annotationUuids.length;
      if (annotationUuids.length < send.length) {
        result.warnings.push(
          `${send.length - annotationUuids.length} instances were sent but not created; re-plan to see them.`,
        );
      }
    }
  }
  return result;
};
