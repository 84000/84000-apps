import { z } from 'zod';
import {
  DEFAULT_APPLY_BUDGET_MS,
  acceptedInstances,
  applyGlossaryInstances,
  loadGlossaryReview,
  writeReviewFile,
  type DataClient,
  type ReviewTier,
} from '@eightyfourthousand/data-access';
import type { McpToolDefinition } from '../../types';
import { errorResult, jsonResult } from '../read/util';
import { TIERS, denied, workUuidSchema } from './shared';

/** Least time left for writing once planning is done. */
const MIN_APPLY_MS = 30_000;

const inputSchema = {
  workUuid: workUuidSchema,
  termUuids: z.array(z.string()).optional().describe('Only these terms.'),
  tiers: z.array(z.enum(TIERS)).optional().describe('Only these review tiers.'),
  keys: z.array(z.string()).optional().describe('Only these candidate keys.'),
  dryRun: z
    .boolean()
    .optional()
    .describe('Run every check and the save path without writing.'),
};

type Input = {
  workUuid: string;
  termUuids?: string[];
  tiers?: ReviewTier[];
  keys?: string[];
  dryRun?: boolean;
};

/**
 * Write tool that adds the accepted glossary instances of a work. Requires
 * `editor.edit`.
 */
export function createApplyGlossaryInstancesTool(
  client: DataClient,
  userId: string,
): McpToolDefinition {
  return {
    name: 'apply-glossary-instances',
    description:
      'Add a work\'s accepted glossary instances to its passages. It re-plans first, so only decisions that still fit the current text are written, and instances already stored are not added twice. Model decisions on a term apply only once the term\'s audit sample has passed. Writes go a chunk of passages at a time, each all-or-nothing, and stop at the first chunk that fails or whose outcome is unknown, or when the time budget runs out. Each chunk re-reads its passages first: an item whose text has changed is counted as `stale`, and one overlapping a stored instance as `skipped`; neither is written. If `remaining` is above 0, call again. If `stopped` is "unknown", re-plan before anything else; never retry blindly. Run with dryRun first and show the editor the counts. Requires editor permissions.',
    inputSchema,
    annotations: {
      title: 'Apply Glossary Instances',
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    handler: async (args) => {
      const input = args as Input;
      const refusal = await denied(client, 'editor.edit');
      if (refusal) return refusal;
      const started = Date.now();
      try {
        const loaded = await loadGlossaryReview({
          client,
          workUuid: input.workUuid,
        });
        if ('error' in loaded) return errorResult(loaded.error);
        const { plan, triage } = loaded.data;
        const items = acceptedInstances(plan, triage, {
          termUuids: input.termUuids,
          tiers: input.tiers,
          keys: input.keys,
        });
        const held: Record<string, number> = {};
        for (const item of triage.items) {
          if (
            ['awaiting-sample', 'needs-editor', 'conflict'].includes(item.state)
          ) {
            held[item.state] = (held[item.state] ?? 0) + 1;
          }
        }

        // Too little time left after planning: write nothing, rather than
        // start a chunk the request may not live to finish.
        const tooLate =
          DEFAULT_APPLY_BUDGET_MS - (Date.now() - started) < MIN_APPLY_MS;
        const result = await applyGlossaryInstances({
          client,
          workUuid: input.workUuid,
          items,
          termOf: plan.input.termOf,
          dryRun: input.dryRun,
          startedAt: started,
          budgetMs: tooLate ? 0 : DEFAULT_APPLY_BUDGET_MS,
        });

        // The uuids written are the undo handle; there can be too many to return.
        const written = result.chunks.flatMap((c) => c.annotationUuids);
        let undo: Record<string, unknown> | undefined;
        if (written.length) {
          const stored = await writeReviewFile({
            client,
            workUuid: input.workUuid,
            folder: 'applied',
            body: JSON.stringify({
              workUuid: input.workUuid,
              appliedBy: userId,
              annotationUuids: written,
            }),
            contentType: 'application/json',
          });
          // Without the file, the uuids themselves are the only undo handle.
          undo = {
            annotations: written.length,
            ...('error' in stored
              ? { error: stored.error, annotationUuids: written }
              : {
                  path: stored.path,
                  ...(written.length <= 50 ? { annotationUuids: written } : {}),
                }),
          };
        }

        return jsonResult({
          ...(result.stopped === 'unknown'
            ? {
                warning:
                  "A chunk's outcome is unknown: it may have been written. Re-plan with plan-glossary-instances before applying again; do not retry blindly.",
              }
            : {}),
          dryRun: result.dryRun,
          inScope: items.length,
          appliedInstances: result.appliedInstances,
          alreadyApplied: result.alreadyApplied,
          stale: result.staleInstances,
          skipped: result.skippedInstances,
          failed: result.failedInstances,
          remaining: result.remainingInstances,
          ...(result.stopped ? { stopped: result.stopped } : {}),
          chunks: result.chunks.map((c) => ({
            passages: c.passages,
            instances: c.instances,
            applied: c.applied,
            ...(c.error ? { error: c.error } : {}),
          })),
          held,
          ...(undo ? { undo } : {}),
          ...(result.warnings.length
            ? {
                warnings: result.warnings.slice(0, 20),
                moreWarnings: Math.max(0, result.warnings.length - 20),
              }
            : {}),
        });
      } catch (err) {
        return errorResult(err instanceof Error ? err.message : String(err));
      }
    },
  };
}
