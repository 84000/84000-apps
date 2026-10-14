/**
 * Review of glossary candidates: decisions recorded in batches, merged, and
 * applied to a fresh plan. Pure.
 *
 * Decisions come at three grains: a rule for a tier, a term or a form
 * (optionally only in a context), a decision on one candidate by key, and an
 * added instance the matcher missed. An editor's decision outranks the
 * model's at every grain; for each decider the finer grain wins, and among
 * equals the later one.
 *
 * Model decisions are audited per term: a sample of the term's model-decided
 * candidates is checked by an editor, and a term whose editor verdicts
 * disagree with the model more than allowed is sent back, so the model's
 * decisions on it are not applied.
 */

import type { GlossaryInstanceItem } from './apply';
import { citedUuid, type GlossaryMatch, type ReviewTier } from './match';
import type { GlossaryPlan } from './plan';
import { reanchorText } from './reanchor';
import {
  SPAN_OVERRIDE_REACH,
  additionKey,
  auditSettings,
  lowerForm,
  orderBatches,
  type AddedInstance,
  type AuditSettings,
  type InstanceDecision,
  type ReviewBatch,
  type ReviewDecider,
  type ReviewRule,
  type ReviewVerdict,
} from './review-batch';
import { contextFingerprint, normalizeForm, stableHash } from './text';

export type ReviewState =
  | 'undecided'
  | 'accepted'
  | 'skipped'
  /** Decided by the model only; the term's sample is not yet checked. */
  | 'awaiting-sample'
  /** Decided by the model only, in a term sent back by its sample. */
  | 'needs-editor'
  /** Accepted, but overlaps another accepted item or a stored instance. */
  | 'conflict'
  | 'applied';

export interface ReviewedItem {
  key: string;
  passageUuid: string;
  /** The match it came from; absent for an added instance. */
  match?: GlossaryMatch;
  state: ReviewState;
  decider?: ReviewDecider;
  /** Where the deciding decision came from. */
  source?: 'rule' | 'instance' | 'addition';
  batchId?: string;
  /** The term and stored range it would be written as, after any override. */
  termUuid: string;
  start: number;
  end: number;
  text: string;
  overridden?: 'term' | 'span' | 'both';
  confidence?: number;
  reason?: string;
}

export type SampleStatus = 'pending' | 'passed' | 'sent-back';

export interface TermSample {
  termUuid: string;
  /** Keys an editor should check, in a stable order. */
  keys: string[];
  /** Model-decided candidates of the term. */
  modelDecided: number;
  checked: number;
  /** Editor verdicts that disagree with the model, sample or not. */
  errors: number;
  status: SampleStatus;
}

export interface ReviewProblem {
  key: string;
  batchId?: string;
  reason: string;
}

export interface ReviewTriage {
  items: ReviewedItem[];
  samples: Map<string, TermSample>;
  settings: AuditSettings;
  /** Decisions whose candidate is gone or changed, or whose override no longer fits. */
  orphans: ReviewProblem[];
  /** Accepted items that overlap another accepted item or a stored instance; not applied. */
  conflicts: ReviewProblem[];
  /** Instance decisions superseded by a later, different one on the same key. */
  superseded: number;
}

interface Stamped<T> {
  value: T;
  decider: ReviewDecider;
  batchId: string;
  order: number;
}

/** What a decider settled for one subject, after normalizing overrides. */
interface Decision {
  verdict: ReviewVerdict;
  decider: ReviewDecider;
  source: 'rule' | 'instance' | 'addition';
  batchId: string;
  /** Set only when it differs from the subject's. */
  termUuid?: string;
  range?: { start: number; end: number };
  confidence?: number;
  reason?: string;
}

/** A candidate or an added instance, before any decision. */
interface Subject {
  key: string;
  passageUuid: string;
  termUuid: string;
  start: number;
  end: number;
  text: string;
  match?: GlossaryMatch;
  addition?: Stamped<AddedInstance>;
}

const WORD = /[\p{L}\p{N}\p{M}]/u;

/** Lowercased, ignorable characters removed, whitespace runs single; not trimmed. */
const loose = (s: string) => normalizeForm(`.${s}.`).slice(1, -1).toLowerCase();

/** Whether the words around a range are the rule's context, on word boundaries. */
const contextMatches = (
  rule: ReviewRule,
  content: string,
  start: number,
  end: number,
) => {
  if (rule.precededBy) {
    const before = loose(
      content.slice(Math.max(0, start - 200), start),
    ).trimEnd();
    const words = lowerForm(rule.precededBy);
    if (!before.endsWith(words)) return false;
    if (WORD.test(before.charAt(before.length - words.length - 1)))
      return false;
  }
  if (rule.followedBy) {
    const after = loose(content.slice(end, end + 200)).trimStart();
    const words = lowerForm(rule.followedBy);
    if (!after.startsWith(words)) return false;
    if (WORD.test(after.charAt(words.length))) return false;
  }
  return true;
};

const specificity = (rule: ReviewRule) =>
  (rule.termUuid ? 2 : 0) +
  (rule.termUuid && rule.tier ? 1 : 0) +
  (rule.form ? 1 : 0) +
  (rule.precededBy || rule.followedBy ? 2 : 0);

const overlaps = (
  a: { start: number; end: number },
  b: { start: number; end: number },
) => a.start < b.end && b.start < a.end;

const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
};

/**
 * Applies every recorded decision to a fresh plan: what each candidate's state
 * is now, which terms' samples are checked, and what no longer fits.
 */
export const triageReview = ({
  plan,
  batches,
}: {
  plan: GlossaryPlan;
  batches: ReviewBatch[];
}): ReviewTriage => {
  const settings = auditSettings(batches);
  const contentOf = new Map(
    plan.input.passages.map((p) => [p.uuid, p.content]),
  );
  const terms = new Set(plan.input.terms.map((t) => t.uuid));
  const orphans: ReviewProblem[] = [];

  // Stored instances by passage, with the term each cites.
  const stored = new Map<
    string,
    { start: number; end: number; termUuid?: string }[]
  >();
  for (const a of plan.input.annotations) {
    if (a.type !== 'glossary-instance') continue;
    const cited = citedUuid(a);
    push(stored, a.passageUuid, {
      start: a.start,
      end: a.end,
      termUuid: (cited && plan.input.termOf.get(cited)) ?? cited,
    });
  }

  // Merge the batches.
  const rulesByTerm = new Map<string, Stamped<ReviewRule>[]>();
  const rulesByTier = new Map<string, Stamped<ReviewRule>[]>();
  const latest = {
    model: new Map<string, Stamped<InstanceDecision>>(),
    editor: new Map<string, Stamped<InstanceDecision>>(),
  };
  const additions = new Map<string, Stamped<AddedInstance>>();
  let superseded = 0;
  const counter = { order: 0 };
  for (const batch of orderBatches(batches)) {
    const stamp = <T>(value: T): Stamped<T> => ({
      value,
      decider: batch.decider,
      batchId: batch.batchId,
      order: counter.order++,
    });
    for (const rule of batch.rules) {
      if (rule.termUuid) push(rulesByTerm, rule.termUuid, stamp(rule));
      else if (rule.tier) push(rulesByTier, rule.tier, stamp(rule));
    }
    for (const decision of batch.instances) {
      const map = latest[batch.decider];
      const prior = map.get(decision.key)?.value;
      if (
        prior &&
        (prior.verdict !== decision.verdict ||
          prior.termUuid !== decision.termUuid ||
          prior.span !== decision.span)
      ) {
        superseded++;
      }
      map.set(decision.key, stamp(decision));
    }
    for (const addition of batch.additions) {
      const key = additionKey(addition);
      // The model never replaces an editor's addition.
      if (additions.get(key)?.decider === 'editor' && batch.decider === 'model')
        continue;
      additions.set(key, stamp(addition));
    }
  }

  // What is to be decided: candidates the rules proposed or excluded, and additions.
  const subjects: Subject[] = [];
  const items: ReviewedItem[] = [];
  const known = new Set<string>();
  for (const match of plan.matches) {
    known.add(match.key);
    if (match.status === 'existing') {
      items.push({
        key: match.key,
        passageUuid: match.passageUuid,
        match,
        state: 'applied',
        termUuid: match.termUuid,
        start: match.start,
        end: match.end,
        text: match.text,
      });
      continue;
    }
    subjects.push({
      key: match.key,
      passageUuid: match.passageUuid,
      termUuid: match.termUuid,
      start: match.start,
      end: match.end,
      text: match.text,
      match,
    });
  }
  for (const [key, added] of additions) {
    known.add(key);
    const a = added.value;
    const content = contentOf.get(a.passageUuid);
    const range =
      content === undefined
        ? null
        : reanchorText({
            content,
            text: a.text,
            occurrence: a.occurrence ?? 1,
          });
    const problem =
      !range || content === undefined
        ? `"${a.text}" is not in the passage`
        : !terms.has(a.termUuid)
          ? 'term is not in the glossary'
          : a.fingerprint &&
              a.fingerprint !==
                contextFingerprint(content, range.start, range.end)
            ? 'the text around it has changed'
            : null;
    if (problem || !range || content === undefined) {
      orphans.push({
        key,
        batchId: added.batchId,
        reason: problem ?? 'not found',
      });
      continue;
    }
    subjects.push({
      key,
      passageUuid: a.passageUuid,
      termUuid: a.termUuid,
      ...range,
      text: content.slice(range.start, range.end),
      addition: added,
    });
  }
  for (const [key, d] of new Map([...latest.model, ...latest.editor])) {
    if (!known.has(key)) {
      orphans.push({
        key,
        batchId: d.batchId,
        reason: 'candidate no longer found',
      });
    }
  }

  const ruleFor = (subject: Subject, decider: ReviewDecider) => {
    const match = subject.match;
    if (!match || match.status !== 'candidate') return undefined;
    const content = contentOf.get(match.passageUuid) ?? '';
    let best: Stamped<ReviewRule> | undefined;
    for (const r of [
      ...(rulesByTerm.get(match.termUuid) ?? []),
      ...(rulesByTier.get(match.tier) ?? []),
    ]) {
      const rule = r.value;
      if (r.decider !== decider) continue;
      if (rule.tier ? rule.tier !== match.tier : match.tier === 'instance')
        continue;
      if (rule.form && lowerForm(rule.form) !== lowerForm(match.matchedForm))
        continue;
      if (!contextMatches(rule, content, match.start, match.end)) continue;
      if (
        !best ||
        specificity(rule) > specificity(best.value) ||
        (specificity(rule) === specificity(best.value) && r.order > best.order)
      ) {
        best = r;
      }
    }
    return best;
  };

  /** An instance decision as it applies to its subject; undefined if its override no longer fits. */
  const normalize = (
    subject: Subject,
    stamped: Stamped<InstanceDecision>,
  ): Decision | undefined => {
    const d = stamped.value;
    const decision: Decision = {
      verdict: d.verdict,
      decider: stamped.decider,
      source: 'instance',
      batchId: stamped.batchId,
      confidence: d.confidence,
      reason: d.reason,
    };
    if (d.verdict === 'skip') return decision;
    if (d.termUuid && d.termUuid !== subject.termUuid) {
      if (!terms.has(d.termUuid)) {
        orphans.push({
          key: subject.key,
          batchId: stamped.batchId,
          reason: 'override term is not in the glossary',
        });
        return undefined;
      }
      decision.termUuid = d.termUuid;
    }
    if (d.span) {
      const range = reanchorText({
        content: contentOf.get(subject.passageUuid) ?? '',
        text: d.span,
        near: subject.start,
      });
      const reach = {
        start: subject.start - SPAN_OVERRIDE_REACH,
        end: subject.end + SPAN_OVERRIDE_REACH,
      };
      if (!range || !overlaps(range, reach)) {
        orphans.push({
          key: subject.key,
          batchId: stamped.batchId,
          reason: `override span "${d.span}" is not at the candidate`,
        });
        return undefined;
      }
      if (range.start !== subject.start || range.end !== subject.end)
        decision.range = range;
    }
    return decision;
  };

  const decide = (
    subject: Subject,
    decider: ReviewDecider,
  ): Decision | undefined => {
    const instance = latest[decider].get(subject.key);
    const fromInstance = instance && normalize(subject, instance);
    if (fromInstance) return fromInstance;
    const added = subject.addition;
    if (added?.decider === decider) {
      return {
        verdict: 'accept',
        decider,
        source: 'addition',
        batchId: added.batchId,
        reason: added.value.reason,
      };
    }
    const rule = ruleFor(subject, decider);
    if (rule && rule.value.verdict !== 'review') {
      return {
        verdict: rule.value.verdict,
        decider,
        source: 'rule',
        batchId: rule.batchId,
        reason: rule.value.reason,
      };
    }
    return undefined;
  };

  const same = (a: Decision, b: Decision) =>
    a.verdict === b.verdict &&
    (a.verdict === 'skip' ||
      (a.termUuid === b.termUuid &&
        a.range?.start === b.range?.start &&
        a.range?.end === b.range?.end));

  // Decide every subject, and audit the model's decisions per term.
  const decided = subjects.map((subject) => ({
    subject,
    editor: decide(subject, 'editor'),
    model: decide(subject, 'model'),
  }));
  const samples = new Map<string, TermSample>();
  const pools = new Map<string, string[]>();
  // An editor's check counts only when the decision still applies.
  const checkedKeys = new Set(
    decided
      .filter(({ editor }) => editor?.source === 'instance')
      .map(({ subject }) => subject.key),
  );
  for (const { subject, editor, model } of decided) {
    if (!model) continue;
    push(pools, subject.termUuid, subject.key);
    let sample = samples.get(subject.termUuid);
    if (!sample) {
      sample = {
        termUuid: subject.termUuid,
        keys: [],
        modelDecided: 0,
        checked: 0,
        errors: 0,
        status: 'passed',
      };
      samples.set(subject.termUuid, sample);
    }
    if (editor?.source === 'instance' && !same(editor, model)) sample.errors++;
  }
  for (const [termUuid, keys] of pools) {
    const sample = samples.get(termUuid) as TermSample;
    sample.modelDecided = keys.length;
    sample.keys = keys
      .map((key) => ({ key, rank: stableHash(key) }))
      .sort(
        (a, b) => a.rank.localeCompare(b.rank) || a.key.localeCompare(b.key),
      )
      .slice(0, settings.sampleSize)
      .map((k) => k.key);
    sample.checked = sample.keys.filter((k) => checkedKeys.has(k)).length;
    sample.status =
      sample.errors > settings.maxSampleErrors
        ? 'sent-back'
        : sample.checked >= sample.keys.length
          ? 'passed'
          : 'pending';
  }

  for (const { subject, editor, model } of decided) {
    const decision = editor ?? model;
    const item: ReviewedItem = {
      key: subject.key,
      passageUuid: subject.passageUuid,
      match: subject.match,
      state: 'undecided',
      termUuid: subject.termUuid,
      start: subject.start,
      end: subject.end,
      text: subject.text,
    };
    items.push(item);
    if (!decision) continue;
    Object.assign(item, {
      decider: decision.decider,
      source: decision.source,
      batchId: decision.batchId,
      confidence: decision.confidence,
      reason: decision.reason,
    });
    if (decision.verdict === 'accept') {
      if (decision.termUuid) {
        item.termUuid = decision.termUuid;
        item.overridden = 'term';
      }
      if (decision.range) {
        const content = contentOf.get(subject.passageUuid) ?? '';
        Object.assign(item, decision.range, {
          text: content.slice(decision.range.start, decision.range.end),
        });
        item.overridden = item.overridden ? 'both' : 'span';
      }
    }
    const status =
      decision.decider === 'editor'
        ? 'passed'
        : samples.get(subject.termUuid)?.status;
    item.state =
      status === 'sent-back'
        ? 'needs-editor'
        : status === 'pending'
          ? 'awaiting-sample'
          : decision.verdict === 'accept'
            ? 'accepted'
            : 'skipped';
  }

  // An accepted item may not touch a stored instance, unless it is that very
  // instance, nor another accepted item.
  const conflicts: ReviewProblem[] = [];
  const accepted = new Map<string, ReviewedItem[]>();
  for (const item of items) {
    if (item.state !== 'accepted') continue;
    const clash = (stored.get(item.passageUuid) ?? []).filter((s) =>
      overlaps(s, item),
    );
    if (
      clash.length === 1 &&
      clash[0].start === item.start &&
      clash[0].end === item.end &&
      clash[0].termUuid === item.termUuid
    ) {
      item.state = 'applied';
      continue;
    }
    if (clash.length) {
      item.state = 'conflict';
      const exact = clash.some(
        (s) => s.start === item.start && s.end === item.end,
      );
      conflicts.push({
        key: item.key,
        batchId: item.batchId,
        reason: exact
          ? 'the span already cites another term'
          : 'overlaps a stored instance',
      });
      continue;
    }
    push(accepted, item.passageUuid, item);
  }
  for (const list of accepted.values()) {
    for (const item of list) {
      const other = list.find((o) => o !== item && overlaps(o, item));
      if (other)
        conflicts.push({
          key: item.key,
          batchId: item.batchId,
          reason: `overlaps accepted ${other.key}`,
        });
    }
  }
  const conflicted = new Set(conflicts.map((c) => c.key));
  for (const item of items)
    if (conflicted.has(item.key)) item.state = 'conflict';

  return { items, samples, settings, orphans, conflicts, superseded };
};

/** Which accepted items an apply covers. */
export interface ApplyScope {
  termUuids?: string[];
  tiers?: ReviewTier[];
  keys?: string[];
}

/** The accepted items in scope, as instances to write. */
export const acceptedInstances = (
  plan: GlossaryPlan,
  triage: ReviewTriage,
  scope: ApplyScope = {},
): (GlossaryInstanceItem & { key: string })[] => {
  const authority = new Map(
    plan.input.terms.map((t) => [t.uuid, t.authorityUuid]),
  );
  const contentOf = new Map(
    plan.input.passages.map((p) => [p.uuid, p.content]),
  );
  const terms = scope.termUuids && new Set(scope.termUuids);
  const tiers = scope.tiers && new Set(scope.tiers);
  const keys = scope.keys && new Set(scope.keys);
  return triage.items
    .filter(
      (item) =>
        item.state === 'accepted' &&
        (!terms || terms.has(item.termUuid)) &&
        (!tiers || (item.match && tiers.has(item.match.tier))) &&
        (!keys || keys.has(item.key)) &&
        authority.has(item.termUuid),
    )
    .map((item) => ({
      key: item.key,
      passageUuid: item.passageUuid,
      start: item.start,
      end: item.end,
      // Stored text, ignorable characters included, as apply will read it.
      text: (contentOf.get(item.passageUuid) ?? '').slice(item.start, item.end),
      termUuid: item.termUuid,
      authorityUuid: authority.get(item.termUuid) as string,
    }));
};
