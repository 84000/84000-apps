import { z } from 'zod';
import {
  loadGlossaryReview,
  reviewTsv,
  writeReviewFile,
  type DataClient,
  type GlossaryReview,
  type ReviewedItem,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { errorResult, jsonResult } from '../read/util';
import {
  STATES,
  TIERS,
  denied,
  itemRow,
  offsetOf,
  reviewTotals,
  workUuidSchema,
} from './shared';

const inputSchema = {
  workUuid: workUuidSchema,
  view: z
    .enum(['summary', 'terms', 'candidates', 'samples', 'problems'])
    .optional()
    .describe(
      'summary (default): totals only. terms: one row per term with counts and examples. candidates: one row per candidate. samples: the model-decided candidates an editor has still to check. problems: orphaned and conflicting decisions.',
    ),
  termUuids: z.array(z.string()).optional().describe('Only these terms.'),
  tiers: z.array(z.enum(TIERS)).optional().describe('Only these review tiers.'),
  states: z
    .array(z.enum(STATES))
    .optional()
    .describe('Only candidates in these states (terms and candidates views).'),
  includeExcluded: z
    .boolean()
    .optional()
    .describe(
      'Include candidates the house rules excluded (candidates view). An instance decision can still accept one.',
    ),
  examples: z
    .number()
    .int()
    .min(0)
    .max(20)
    .optional()
    .describe('Examples per term in the terms view. Default 3.'),
  cursor: z.string().optional().describe('The nextCursor of a previous page.'),
  limit: z
    .number()
    .int()
    .min(1)
    .max(500)
    .optional()
    .describe('Rows per page. Default 50 terms or 100 candidates.'),
  download: z
    .boolean()
    .optional()
    .describe(
      'Also store every candidate as TSV and return a signed URL to it, valid for an hour, for reading with a shell. Storing it needs editor permissions.',
    ),
};

type Input = {
  workUuid: string;
  view?: 'summary' | 'terms' | 'candidates' | 'samples' | 'problems';
  termUuids?: string[];
  tiers?: string[];
  states?: string[];
  includeExcluded?: boolean;
  examples?: number;
  cursor?: string;
  limit?: number;
  download?: boolean;
};

const page = <T>(rows: T[], cursor: string | undefined, limit: number) => {
  const start = offsetOf(cursor);
  const end = start + limit;
  return {
    rows: rows.slice(start, end),
    total: rows.length,
    ...(end < rows.length ? { nextCursor: String(end) } : {}),
  };
};

const termRows = (
  review: GlossaryReview,
  items: ReviewedItem[],
  examples: number,
) => {
  const { plan, triage } = review;
  const byTerm = new Map<string, ReviewedItem[]>();
  for (const item of items) {
    const list = byTerm.get(item.termUuid) ?? [];
    list.push(item);
    byTerm.set(item.termUuid, list);
  }
  const terms = new Map(plan.input.terms.map((t) => [t.uuid, t]));
  const rows = [...byTerm].map(([termUuid, list]) => {
    const term = terms.get(termUuid);
    const states: Record<string, number> = {};
    const tiers: Record<string, number> = {};
    const forms: Record<string, number> = {};
    const flags = new Set<string>();
    for (const item of list) {
      states[item.state] = (states[item.state] ?? 0) + 1;
      if (!item.match) continue;
      tiers[item.match.tier] = (tiers[item.match.tier] ?? 0) + 1;
      forms[item.match.matchedForm] = (forms[item.match.matchedForm] ?? 0) + 1;
      if (item.match.signals.homograph) flags.add('homograph');
      if (item.match.signals.ordinaryWord) flags.add('ordinary-word');
      if (item.match.signals.form === 'alternative') flags.add('alternative');
    }
    const applied = states['applied'] ?? 0;
    // Excluded matches nobody has decided are reported, not counted as open.
    const open = list.filter(
      (i) =>
        i.state !== 'applied' &&
        !(i.match?.status === 'excluded' && i.state === 'undecided'),
    ).length;
    const sample = triage.samples.get(termUuid);
    return {
      term: plan.anchors.get(termUuid),
      termUuid,
      english: term?.english ?? null,
      alternatives: term?.alternatives ?? [],
      states,
      tiers,
      forms,
      flags: [...flags],
      // Shown, and used to order; never a reason to drop a candidate.
      coverage:
        applied + open ? +(applied / (applied + open)).toFixed(3) : null,
      ...(sample
        ? {
            audit: {
              status: sample.status,
              size: sample.keys.length,
              checked: sample.checked,
              errors: sample.errors,
            },
          }
        : {}),
      examples: list
        .filter((i) => i.state !== 'applied')
        .sort(
          (a, b) =>
            (a.state === 'undecided' ? 0 : 1) -
            (b.state === 'undecided' ? 0 : 1),
        )
        .slice(0, examples)
        .map((i) => itemRow(review, i)),
      /** Candidates not yet applied. */
      open,
    };
  });
  // Most open work first; within that, the least covered.
  return rows.sort(
    (a, b) =>
      b.open - a.open ||
      (a.coverage ?? 0) - (b.coverage ?? 0) ||
      String(a.english).localeCompare(String(b.english)),
  );
};

/**
 * Read tool that plans a work's glossary instances and shows where their
 * review stands. Requires `editor.read`.
 */
export function createPlanGlossaryInstancesTool(
  client: DataClient,
): McpToolDefinition {
  return {
    name: 'plan-glossary-instances',
    description:
      "Find where a work's glossary terms occur in its draft passages and show where their review stands. Every call re-reads the draft and applies every recorded review decision, so it is always current. Candidates are keyed (`key`) and cite passages and terms by the work snapshot's anchors (p-…, g-…). Matches the house rules exclude are reported with a reason, never dropped. Start with the summary, page through terms or candidates by tier or state, and use samples to see what an editor must check before the model's decisions on a term apply. Record decisions with record-glossary-review; write accepted ones with apply-glossary-instances. Requires editor permissions.",
    inputSchema,
    annotations: {
      title: 'Plan Glossary Instances',
      readOnlyHint: true,
      openWorldHint: false,
    },
    handler: async (args) => {
      const input = args as Input;
      const refusal = await denied(client, 'editor.read');
      if (refusal) return refusal;
      try {
        const loaded = await loadGlossaryReview({
          client,
          workUuid: input.workUuid,
        });
        if ('error' in loaded) return errorResult(loaded.error);
        const review = loaded.data;

        const terms = input.termUuids && new Set(input.termUuids);
        const tiers = input.tiers && new Set(input.tiers);
        const states = input.states && new Set(input.states);
        const view = input.view ?? 'summary';
        const items = review.triage.items.filter(
          (i) =>
            (!terms || terms.has(i.termUuid)) &&
            (!tiers || (i.match && tiers.has(i.match.tier))) &&
            (!states || states.has(i.state)) &&
            (input.includeExcluded ||
              view !== 'candidates' ||
              i.match?.status !== 'excluded' ||
              i.state !== 'undecided'),
        );

        let body: Record<string, unknown> = {};
        if (view === 'terms') {
          const limit = input.limit ?? 50;
          const { rows, ...rest } = page(
            termRows(review, items, input.examples ?? 3),
            input.cursor,
            limit,
          );
          body = { terms: rows, ...rest };
        } else if (view === 'candidates') {
          const { rows, ...rest } = page(
            items,
            input.cursor,
            input.limit ?? 100,
          );
          body = { candidates: rows.map((i) => itemRow(review, i)), ...rest };
        } else if (view === 'samples') {
          const byKey = new Map(review.triage.items.map((i) => [i.key, i]));
          const due = [...review.triage.samples.values()]
            .filter(
              (s) => s.status !== 'passed' && (!terms || terms.has(s.termUuid)),
            )
            .flatMap((s) =>
              s.keys
                .map((key) => byKey.get(key))
                .filter(
                  (i): i is ReviewedItem =>
                    !!i && !(i.decider === 'editor' && i.source === 'instance'),
                ),
            );
          const { rows, ...rest } = page(due, input.cursor, input.limit ?? 100);
          body = { samples: rows.map((i) => itemRow(review, i)), ...rest };
        } else if (view === 'problems') {
          body = {
            orphans: review.triage.orphans,
            conflicts: review.triage.conflicts,
          };
        }

        if (input.download) {
          const stored = await writeReviewFile({
            client,
            workUuid: input.workUuid,
            folder: 'candidates',
            body: reviewTsv(review.plan, review.triage),
            contentType: 'text/tab-separated-values',
          });
          body['download'] =
            'error' in stored ? { error: stored.error } : stored;
        }

        return jsonResult({ ...reviewTotals(review), view, ...body });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };
}
