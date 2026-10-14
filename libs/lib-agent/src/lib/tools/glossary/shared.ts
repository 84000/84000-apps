import { z } from 'zod';
import {
  DEFAULT_MAX_SAMPLE_ERRORS,
  DEFAULT_SAMPLE_SIZE,
  contextOf,
  hasPermission,
  type DataClient,
  type GlossaryReview,
  type ReviewedItem,
  type ReviewState,
} from '@eightyfourthousand/data-access';
import { errorResult } from '../read/util';

export const TIERS = ['auto', 'term', 'instance'] as const;
export const STATES = [
  'undecided',
  'accepted',
  'skipped',
  'awaiting-sample',
  'needs-editor',
  'conflict',
  'applied',
] as const satisfies readonly ReviewState[];

export const workUuidSchema = z
  .string()
  .describe('UUID of the work, e.g. from resolve-toh.');

export const settingsSchema = z
  .object({
    sampleSize: z
      .number()
      .int()
      .min(0)
      .max(200)
      .optional()
      .describe(
        `Model-decided candidates per term an editor checks before the model's decisions on that term apply. Default ${DEFAULT_SAMPLE_SIZE}; 0 turns the audit off.`,
      ),
    maxSampleErrors: z
      .number()
      .int()
      .min(0)
      .optional()
      .describe(
        `Editor verdicts that may disagree with the model on a term before the term goes back to the editor. Default ${DEFAULT_MAX_SAMPLE_ERRORS}.`,
      ),
  })
  .optional()
  .describe(
    'Change how model decisions are audited, for this work from now on. Editor decisions only; the latest setting wins.',
  );

/** Refuses the call unless the account holds `permission`. */
export const denied = async (
  client: DataClient,
  permission: 'editor.read' | 'editor.edit',
) =>
  (await hasPermission({ client, permission }))
    ? null
    : errorResult(
        `This tool requires the ${permission} permission on the current account.`,
      );

const count = <T>(items: T[], key: (item: T) => string | undefined) => {
  const out: Record<string, number> = {};
  for (const item of items) {
    const k = key(item);
    if (k) out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};

/** Counts by state and tier, what the rules excluded, and the audit's standing. */
export const reviewTotals = ({ plan, triage, warnings }: GlossaryReview) => {
  const samples = [...triage.samples.values()];
  const byTier: Record<string, Record<string, number>> = {};
  for (const item of triage.items) {
    if (item.match?.status === 'excluded' && item.state === 'undecided')
      continue;
    const tier = item.match?.tier ?? 'added';
    byTier[tier] ??= {};
    byTier[tier][item.state] = (byTier[tier][item.state] ?? 0) + 1;
  }
  return {
    workUuid: plan.workUuid,
    passages: plan.input.passages.length,
    terms: plan.input.terms.length,
    byState: count(
      triage.items.filter(
        (i) => !(i.match?.status === 'excluded' && i.state === 'undecided'),
      ),
      (i) => i.state,
    ),
    byTier,
    excluded: count(
      triage.items.filter(
        (i) => i.match?.status === 'excluded' && i.state === 'undecided',
      ),
      (i) => i.match?.reason,
    ),
    audit: count(samples, (s) => s.status),
    orphans: triage.orphans.length,
    conflicts: triage.conflicts.length,
    superseded: triage.superseded,
    timings: plan.timings,
    ...(warnings.length ? { warnings } : {}),
  };
};

/** One reviewed item as the model reads it: anchors, the text in context, and its state. */
const passageMaps = new WeakMap<
  object,
  Map<string, { label: string | null; content: string }>
>();

export const itemRow = ({ plan }: GlossaryReview, item: ReviewedItem) => {
  let passages = passageMaps.get(plan);
  if (!passages) {
    passages = new Map(plan.input.passages.map((p) => [p.uuid, p]));
    passageMaps.set(plan, passages);
  }
  const passage = passages.get(item.passageUuid);
  return {
    key: item.key,
    passage: plan.anchors.get(item.passageUuid),
    label: passage?.label ?? null,
    term: plan.anchors.get(item.termUuid),
    termUuid: item.termUuid,
    text: item.text,
    context: contextOf(passage?.content ?? '', item.start, item.end, 60),
    tier: item.match?.tier ?? null,
    status: item.match?.status ?? 'added',
    ...(item.match?.reason ? { reason: item.match.reason } : {}),
    ...(item.match?.otherTermUuids.length
      ? {
          otherTerms: item.match.otherTermUuids.map((u) => plan.anchors.get(u)),
        }
      : {}),
    state: item.state,
    ...(item.decider ? { decider: item.decider, source: item.source } : {}),
    ...(item.overridden ? { overridden: item.overridden } : {}),
  };
};

/** Parses a numeric cursor; anything else starts at the beginning. */
export const offsetOf = (cursor?: string) => {
  const n = Number(cursor);
  return Number.isInteger(n) && n > 0 ? n : 0;
};
