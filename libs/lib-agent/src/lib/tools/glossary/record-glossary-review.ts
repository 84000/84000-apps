import { z } from 'zod';
import {
  SPAN_OVERRIDE_REACH,
  additionKey,
  contextFingerprint,
  loadGlossaryReview,
  reanchorText,
  triageReview,
  writeReviewBatch,
  type AddedInstance,
  type DataClient,
  type InstanceDecision,
  type AuditSettings,
  type ReviewBatch,
  type ReviewRule,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { errorResult, jsonResult } from '../read/util';
import {
  TIERS,
  denied,
  reviewTotals,
  settingsSchema,
  workUuidSchema,
} from './shared';

const reason = z.string().max(300).optional().describe('One line: why.');

const inputSchema = {
  workUuid: workUuidSchema,
  decider: z
    .enum(['model', 'editor'])
    .describe(
      'Who made these decisions. "editor" only for what the editor decided or confirmed in this conversation; your own judgments are "model", and are audited by sample before they apply.',
    ),
  model: z
    .string()
    .max(100)
    .optional()
    .describe('The model that judged, for model decisions.'),
  rules: z
    .array(
      z.object({
        termUuid: z
          .string()
          .optional()
          .describe('The proposed term it covers.'),
        tier: z
          .enum(TIERS)
          .optional()
          .describe('With no termUuid: every candidate of this tier.'),
        form: z
          .string()
          .optional()
          .describe('Only candidates that matched this form.'),
        verdict: z
          .enum(['accept', 'skip', 'review'])
          .describe('review leaves each candidate to an instance decision.'),
        precededBy: z
          .string()
          .optional()
          .describe(
            'Only where the text just before the match ends with this.',
          ),
        followedBy: z
          .string()
          .optional()
          .describe(
            'Only where the text just after the match starts with this.',
          ),
        reason,
      }),
    )
    .max(2000)
    .optional()
    .describe(
      'Decisions for many candidates at once. The most specific rule wins: context over form over term over tier.',
    ),
  instances: z
    .array(
      z.object({
        key: z
          .string()
          .describe(
            'A candidate key from plan-glossary-instances, or the key of an added instance.',
          ),
        verdict: z.enum(['accept', 'skip']),
        termUuid: z
          .string()
          .optional()
          .describe(
            'Accept it as this term instead (a homograph, a related term).',
          ),
        span: z
          .string()
          .optional()
          .describe(
            'Accept this span instead, named by its text in the passage, e.g. "spirit of awakening"; it must be at or beside the candidate. Never offsets.',
          ),
        confidence: z.number().min(0).max(1).optional(),
        reason,
      }),
    )
    .max(5000)
    .optional()
    .describe('Decisions on single candidates. They outrank any rule.'),
  additions: z
    .array(
      z.object({
        passageUuid: z.string(),
        text: z.string().describe('The span, as it reads in the passage.'),
        occurrence: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe('Which occurrence of text in the passage. Default 1.'),
        termUuid: z.string(),
        reason,
      }),
    )
    .max(1000)
    .optional()
    .describe('Instances the plan did not propose.'),
  dryRun: z
    .boolean()
    .optional()
    .describe('Validate and show the effect without recording.'),
  settings: settingsSchema,
};

type Input = {
  workUuid: string;
  decider: 'model' | 'editor';
  model?: string;
  rules?: ReviewRule[];
  instances?: InstanceDecision[];
  additions?: AddedInstance[];
  dryRun?: boolean;
  settings?: Partial<AuditSettings>;
};

/**
 * Write tool that records glossary review decisions for a work. Requires
 * `editor.edit`. Each call adds one batch; nothing recorded is replaced.
 */
export function createRecordGlossaryReviewTool(
  client: DataClient,
  userId: string,
): McpToolDefinition {
  return {
    name: 'record-glossary-review',
    description:
      "Record review decisions on a work's glossary candidates: rules for a tier, term or form (optionally only in a context), decisions on single candidates by key with optional term or span overrides, and instances the plan missed. Nothing is written to the text; apply-glossary-instances does that. Decisions persist across re-plans and never need repeating. Each call adds a batch and never replaces one; a later decision on the same candidate supersedes an earlier one, and an editor's outranks the model's. Entries that do not validate are returned in `rejected` and not recorded. Requires editor permissions.",
    inputSchema,
    annotations: {
      title: 'Record Glossary Review',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    handler: async (args) => {
      const input = args as Input;
      const refusal = await denied(client, 'editor.edit');
      if (refusal) return refusal;
      if (input.settings && input.decider !== 'editor') {
        return errorResult(
          'Only an editor changes the audit settings: record them with decider "editor".',
        );
      }
      try {
        const loaded = await loadGlossaryReview({
          client,
          workUuid: input.workUuid,
        });
        if ('error' in loaded) return errorResult(loaded.error);
        const { plan } = loaded.data;
        const terms = new Set(plan.input.terms.map((t) => t.uuid));
        // Candidates and added instances, by key.
        const subjects = new Map(
          loaded.data.triage.items
            .filter((i) => i.match?.status !== 'existing')
            .map((i) => [
              i.key,
              {
                passageUuid: i.passageUuid,
                start: i.match?.start ?? i.start,
                end: i.match?.end ?? i.end,
              },
            ]),
        );
        const passages = new Map(
          plan.input.passages.map((p) => [p.uuid, p.content]),
        );
        const rejected: { entry: string; reason: string }[] = [];

        const rules = (input.rules ?? []).filter((r, i) => {
          const problem = r.termUuid
            ? terms.has(r.termUuid)
              ? null
              : 'term is not in the glossary'
            : r.tier
              ? null
              : 'a rule needs a termUuid or a tier';
          if (problem) rejected.push({ entry: `rules[${i}]`, reason: problem });
          return !problem;
        });
        const instances = (input.instances ?? []).filter((d, i) => {
          const subject = subjects.get(d.key);
          let problem: string | null = null;
          if (!subject) problem = 'no candidate has this key; re-plan';
          else if (d.termUuid && !terms.has(d.termUuid))
            problem = 'term is not in the glossary';
          else if (d.span) {
            const range = reanchorText({
              content: passages.get(subject.passageUuid) ?? '',
              text: d.span,
              near: subject.start,
            });
            if (!range) problem = `"${d.span}" is not in the passage`;
            else if (
              range.end <= subject.start - SPAN_OVERRIDE_REACH ||
              range.start >= subject.end + SPAN_OVERRIDE_REACH
            )
              problem = `"${d.span}" is not at the candidate`;
          }
          if (problem)
            rejected.push({
              entry: `instances[${i}] ${d.key}`,
              reason: problem,
            });
          return !problem;
        });
        // Ranges a new addition may not repeat: candidates, stored instances,
        // and what an editor already added.
        const taken = new Set([
          ...loaded.data.triage.items.map(
            (i) =>
              `${i.passageUuid}|${i.match?.start ?? i.start}|${i.match?.end ?? i.end}`,
          ),
          ...plan.input.annotations
            .filter((a) => a.type === 'glossary-instance')
            .map((a) => `${a.passageUuid}|${a.start}|${a.end}`),
        ]);
        const editorAdded = new Set(
          loaded.data.batches
            .filter((b) => b.decider === 'editor')
            .flatMap((b) => b.additions.map(additionKey)),
        );
        const additions: AddedInstance[] = [];
        (input.additions ?? []).forEach((a, i) => {
          const content = passages.get(a.passageUuid);
          const range =
            content === undefined
              ? null
              : reanchorText({
                  content,
                  text: a.text,
                  occurrence: a.occurrence ?? 1,
                });
          const problem =
            content === undefined
              ? 'passage is not in this work'
              : !terms.has(a.termUuid)
                ? 'term is not in the glossary'
                : !range
                  ? `"${a.text}" is not in the passage`
                  : taken.has(`${a.passageUuid}|${range.start}|${range.end}`)
                    ? 'this span is already a candidate or an instance; decide it by its key'
                    : input.decider === 'model' &&
                        editorAdded.has(additionKey(a))
                      ? 'an editor already added this'
                      : null;
          if (problem || !range || content === undefined) {
            rejected.push({
              entry: `additions[${i}]`,
              reason: problem ?? 'not found',
            });
            return;
          }
          // The text around it, so an edit there makes the addition stale.
          additions.push({
            ...a,
            fingerprint: contextFingerprint(content, range.start, range.end),
          });
        });

        const batch: ReviewBatch = {
          version: 1,
          batchId: crypto.randomUUID(),
          workUuid: input.workUuid,
          recordedAt: new Date().toISOString(),
          recordedBy: userId,
          decider: input.decider,
          ...(input.model ? { model: input.model } : {}),
          rules,
          instances,
          additions,
          ...(input.settings ? { settings: input.settings } : {}),
        };
        const recorded = {
          rules: rules.length,
          instances: instances.length,
          additions: additions.length,
          ...(input.settings ? { settings: input.settings } : {}),
        };
        const after = {
          ...loaded.data,
          triage: triageReview({
            plan,
            batches: [...loaded.data.batches, batch],
          }),
        };

        if (
          !input.dryRun &&
          (rules.length + instances.length + additions.length > 0 ||
            input.settings)
        ) {
          const written = await writeReviewBatch({ client, batch });
          if ('error' in written) return errorResult(written.error);
        }
        return jsonResult({
          dryRun: !!input.dryRun,
          recorded: input.dryRun ? null : recorded,
          ...(input.dryRun ? { wouldRecord: recorded } : {}),
          rejected,
          ...(additions.length
            ? { additionKeys: additions.map(additionKey) }
            : {}),
          batchId: input.dryRun ? null : batch.batchId,
          review: reviewTotals(after),
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };
}
