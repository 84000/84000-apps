/**
 * Review batches: what one record call stores, and how batches are read back.
 * Batches are only ever added; readers merge them in recorded order. Pure.
 */

import type { ReviewTier } from './match';
import { normalizeForm, stableHash } from './text';

export const DEFAULT_SAMPLE_SIZE = 20;
export const DEFAULT_MAX_SAMPLE_ERRORS = 1;
/** How far a span override may sit from its candidate, in characters. */
export const SPAN_OVERRIDE_REACH = 40;

export type ReviewDecider = 'model' | 'editor';
export type ReviewVerdict = 'accept' | 'skip';

/** One decision for every candidate of a tier, a term, or one of its forms. */
export interface ReviewRule {
  /** The proposed term it covers. Omit, with `tier`, for a whole tier. */
  termUuid?: string;
  /**
   * Only candidates of this tier. A term rule without one never covers the
   * instance tier, whose candidates are judged one by one.
   */
  tier?: ReviewTier;
  /** Only candidates that matched this form (case-insensitive). */
  form?: string;
  /** `review` leaves each candidate to an instance decision. */
  verdict: ReviewVerdict | 'review';
  /** Only where the words just before the match are these. */
  precededBy?: string;
  /** Only where the words just after the match are these. */
  followedBy?: string;
  reason?: string;
}

/** A decision on one candidate or added instance, by its key. */
export interface InstanceDecision {
  key: string;
  verdict: ReviewVerdict;
  /** Accept it as this term instead. */
  termUuid?: string;
  /** Accept this span instead, named by its text; it must be near the candidate. */
  span?: string;
  confidence?: number;
  reason?: string;
}

/** An instance the matcher did not propose, named by its text in a passage. */
export interface AddedInstance {
  passageUuid: string;
  text: string;
  /** Which occurrence of `text` in the passage (1-based). Defaults to the first. */
  occurrence?: number;
  termUuid: string;
  /** The text around it when it was recorded; a change makes it stale. */
  fingerprint?: string;
  reason?: string;
}

/** How model decisions are audited. Set by an editor; the latest setting wins. */
export interface AuditSettings {
  /** Model-decided candidates per term an editor checks. 0 turns the audit off. */
  sampleSize: number;
  /** Editor verdicts that may disagree with the model before the term is sent back. */
  maxSampleErrors: number;
}

/** What one record call stored. Batches are never edited, only added. */
export interface ReviewBatch {
  version: 1;
  batchId: string;
  workUuid: string;
  /** Server time. */
  recordedAt: string;
  /** The account that recorded it. */
  recordedBy: string;
  decider: ReviewDecider;
  model?: string;
  rules: ReviewRule[];
  instances: InstanceDecision[];
  additions: AddedInstance[];
  /** Honoured only in an editor's batch. */
  settings?: Partial<AuditSettings>;
}

/** Batches in recorded order: server time, then batch id. */
export const orderBatches = (batches: ReviewBatch[]): ReviewBatch[] =>
  [...batches].sort(
    (a, b) =>
      a.recordedAt.localeCompare(b.recordedAt) ||
      a.batchId.localeCompare(b.batchId),
  );

/** The audit settings in force: the latest an editor recorded, else the defaults. */
export const auditSettings = (batches: ReviewBatch[]): AuditSettings => {
  const settings: AuditSettings = {
    sampleSize: DEFAULT_SAMPLE_SIZE,
    maxSampleErrors: DEFAULT_MAX_SAMPLE_ERRORS,
  };
  for (const batch of orderBatches(batches)) {
    if (batch.decider !== 'editor' || !batch.settings) continue;
    const { sampleSize, maxSampleErrors } = batch.settings;
    if (Number.isInteger(sampleSize) && (sampleSize as number) >= 0) {
      settings.sampleSize = sampleSize as number;
    }
    if (Number.isInteger(maxSampleErrors) && (maxSampleErrors as number) >= 0) {
      settings.maxSampleErrors = maxSampleErrors as number;
    }
  }
  return settings;
};

const TIER_VALUES = new Set<unknown>(['auto', 'term', 'instance']);
const str = (v: unknown) => typeof v === 'string' && v.length > 0;
const optStr = (v: unknown) => v === undefined || str(v);
const optWords = (v: unknown) =>
  v === undefined || (str(v) && normalizeForm(v as string).length > 0);

const validRule = (r: ReviewRule) =>
  !!r &&
  ['accept', 'skip', 'review'].includes(r.verdict) &&
  optStr(r.termUuid) &&
  (r.tier === undefined || TIER_VALUES.has(r.tier)) &&
  (str(r.termUuid) || r.tier !== undefined) &&
  optStr(r.form) &&
  optWords(r.precededBy) &&
  optWords(r.followedBy);

const validInstance = (d: InstanceDecision) =>
  !!d &&
  str(d.key) &&
  (d.verdict === 'accept' || d.verdict === 'skip') &&
  optStr(d.termUuid) &&
  optStr(d.span) &&
  (d.confidence === undefined || typeof d.confidence === 'number');

const validAddition = (a: AddedInstance) =>
  !!a &&
  str(a.passageUuid) &&
  str(a.text) &&
  str(a.termUuid) &&
  optStr(a.fingerprint) &&
  (a.occurrence === undefined ||
    (Number.isInteger(a.occurrence) && a.occurrence >= 1));

/** A batch with its malformed entries removed, and how many there were. */
export const sanitizeBatch = (
  batch: ReviewBatch,
): { batch: ReviewBatch; dropped: number } => {
  const rules = batch.rules.filter(validRule);
  const instances = batch.instances.filter(validInstance);
  const additions = batch.additions.filter(validAddition);
  const dropped =
    batch.rules.length -
    rules.length +
    batch.instances.length -
    instances.length +
    batch.additions.length -
    additions.length;
  return { batch: { ...batch, rules, instances, additions }, dropped };
};

/** A form as decisions compare it: normalized and lowercased. */
export const lowerForm = (s: string) => normalizeForm(s).toLowerCase();

/** The key an added instance is known by across re-plans; a different term is a different addition. */
export const additionKey = (a: AddedInstance): string =>
  `a-${stableHash(`${a.passageUuid}|${lowerForm(a.text)}|${a.occurrence ?? 1}|${a.termUuid}`)}`;
