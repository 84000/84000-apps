/**
 * The glossary resolver's matcher: every place a work's glossary terms occur in
 * its passages, classified by the house rules. Pure.
 *
 * The rules decide boundaries and report exclusions; they never decide whether
 * an occurrence is the term in its glossary sense. That is review's job, so a
 * match the rules have no objection to is a candidate, however unlikely.
 */

import type { ResolveAnnotation, ResolveInput, ResolveTerm } from './read';
import {
  contextFingerprint,
  normalizeForm,
  searchableText,
  stableHash,
  storedRange,
} from './text';

/** Why the rules set a match aside. An excluded match is reported, never dropped. */
export type ExclusionReason =
  | 'passage-type'
  | 'title-line'
  | 'inline-title'
  | 'foreign'
  | 'mantra'
  | 'overlaps-existing'
  | 'existing-other-term'
  | 'overlaps-longer-match';

/**
 * How a candidate is reviewed, from what the match itself shows. Never from
 * existing instances, so a work with none is tiered the same way.
 * - `auto`: the term's own English, not an ordinary word, unambiguous;
 * - `term`: one decision per term or form will do (ordinary words, alternatives);
 * - `instance`: needs a look at each occurrence (homographs, odd casing).
 */
export type ReviewTier = 'auto' | 'term' | 'instance';

export interface MatchSignals {
  /** Matched the term's English, or one of its alternatives. */
  form: 'english' | 'alternative';
  plural: boolean;
  /**
   * `initial`: only the first letter's case differs, as at a sentence start.
   * `title`: a lowercase form written with every word capitalized, as an epithet.
   */
  case: 'exact' | 'initial' | 'title' | 'other';
  /** The form belongs to more than one term. */
  homograph: boolean;
  /** The form is plain lowercase English, so it may be the ordinary word. */
  ordinaryWord: boolean;
  /** Touches a hyphen, so it is one part of a compound. */
  hyphenated: boolean;
}

export interface GlossaryMatch {
  /**
   * Stable across re-plans while the text around it is unchanged; an edit
   * nearby gives it a new key, so an old decision cannot attach to it.
   */
  key: string;
  passageUuid: string;
  /** The term proposed. A homograph lists the others in `otherTermUuids`. */
  termUuid: string;
  otherTermUuids: string[];
  /** Stored offsets. */
  start: number;
  end: number;
  /** The matched text, ignorable characters removed. */
  text: string;
  /** The glossary form it matched. */
  matchedForm: string;
  signals: MatchSignals;
  tier: ReviewTier;
  status: 'candidate' | 'existing' | 'excluded';
  reason?: ExclusionReason;
}

const EXCLUDED_PASSAGE_TYPES = new Set([
  'acknowledgment',
  'abbreviations',
  'appendix',
]);

const isExcludedPassageType = (type: string) =>
  type.endsWith('Header') || EXCLUDED_PASSAGE_TYPES.has(type);

const ORDINARY = /^[a-z][a-z '’-]*$/;
const ESCAPE = /[.*+?^${}()|[\]\\]/g;

/** The glossary uuid an annotation cites, if any. */
export const citedUuid = (
  annotation: ResolveAnnotation,
): string | undefined => {
  for (const entry of annotation.content) {
    if (typeof entry['uuid'] === 'string') return entry['uuid'];
  }
  return undefined;
};

const valueOf = (annotation: ResolveAnnotation, key: string) =>
  annotation.content.find((entry) => key in entry)?.[key];

/** Every form a term may appear as, with a leading article dropped. */
export const formsOf = (
  term: ResolveTerm,
): { form: string; kind: MatchSignals['form'] }[] => {
  const strip = (name: string) => {
    const form = normalizeForm(name);
    const bare = form.replace(/^the\s+/i, '');
    return bare.length ? bare : form;
  };
  const out = new Map<string, MatchSignals['form']>();
  if (term.english && strip(term.english))
    out.set(strip(term.english), 'english');
  for (const alternative of term.alternatives) {
    const form = strip(alternative);
    if (form && !out.has(form)) out.set(form, 'alternative');
  }
  return [...out].map(([form, kind]) => ({ form, kind }));
};

interface FormEntry {
  form: string;
  /** Terms that carry this form (by lowercase), english-form owners first. */
  terms: { uuid: string; kind: MatchSignals['form'] }[];
}

/** A compiled matcher for a term set; build once per plan. */
export interface Matcher {
  regex: RegExp | null;
  forms: Map<string, FormEntry>;
}

export const buildMatcher = (terms: ResolveTerm[]): Matcher => {
  const forms = new Map<string, FormEntry>();
  for (const term of terms) {
    for (const { form, kind } of formsOf(term)) {
      const key = form.toLowerCase();
      const entry = forms.get(key) ?? { form, terms: [] };
      if (!entry.terms.some((t) => t.uuid === term.uuid)) {
        entry.terms.push({ uuid: term.uuid, kind });
      }
      forms.set(key, entry);
    }
  }
  for (const entry of forms.values()) {
    entry.terms.sort(
      (a, b) =>
        (a.kind === 'english' ? 0 : 1) - (b.kind === 'english' ? 0 : 1) ||
        a.uuid.localeCompare(b.uuid),
    );
  }
  const alternatives = [...forms.values()]
    .map((e) => e.form)
    .sort((a, b) => b.length - a.length || a.localeCompare(b))
    .map((form) => form.replace(ESCAPE, '\\$&').replace(/ /g, '\\s+'));
  return {
    forms,
    regex: alternatives.length
      ? new RegExp(
          `(?<![\\p{L}\\p{N}\\p{M}])(${alternatives.join('|')})((?:es|s)?)(?![\\p{L}\\p{N}\\p{M}])`,
          'giu',
        )
      : null,
  };
};

const caseOf = (surface: string, form: string): MatchSignals['case'] => {
  const s = surface.replace(/\s+/g, ' ');
  if (s === form) return 'exact';
  const flip = (t: string) => t.charAt(0).toLowerCase() + t.slice(1);
  if (flip(s) === flip(form)) return 'initial';
  const title = form.replace(
    /(^|[\s-])(\p{Ll})/gu,
    (_, gap, c) => gap + c.toUpperCase(),
  );
  return s === title ? 'title' : 'other';
};

export const tierOf = (signals: MatchSignals): ReviewTier => {
  if (signals.homograph || signals.case === 'other') return 'instance';
  if (signals.form === 'english' && !signals.ordinaryWord) return 'auto';
  return 'term';
};

interface Raw {
  start: number;
  end: number;
  text: string;
  entry: FormEntry;
  plural: boolean;
  surface: string;
}

/** Every match in one passage, overlapping ones included, in searchable coordinates. */
const scan = (text: string, matcher: Matcher): Raw[] => {
  const found: Raw[] = [];
  if (!matcher.regex) return found;
  const regex = new RegExp(matcher.regex.source, matcher.regex.flags);
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text))) {
    const surface = m[1];
    const entry = matcher.forms.get(surface.replace(/\s+/g, ' ').toLowerCase());
    if (entry) {
      found.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        entry,
        plural: m[2].length > 0,
        surface,
      });
    }
    // Restart one code point on, so a match that starts inside this one is
    // found too. (Half a surrogate pair would be read as its start again.)
    regex.lastIndex =
      m.index + ((text.codePointAt(m.index) ?? 0) > 0xffff ? 2 : 1);
  }
  return found;
};

const overlaps = (
  a: { start: number; end: number },
  b: { start: number; end: number },
) => a.start < b.end && b.start < a.end;

/** Matches every term of the work against every passage. */
export const matchGlossaryInstances = (
  input: ResolveInput,
  matcher: Matcher = buildMatcher(input.terms),
): GlossaryMatch[] => {
  const byPassage = new Map<string, ResolveAnnotation[]>();
  for (const a of input.annotations) {
    const list = byPassage.get(a.passageUuid) ?? [];
    list.push(a);
    byPassage.set(a.passageUuid, list);
  }

  const out: GlossaryMatch[] = [];
  for (const passage of input.passages) {
    const searchable = searchableText(passage.content);
    const raw = scan(searchable.text, matcher);
    if (!raw.length) continue;

    // Longest first, then leftmost: a phrase wins over a word inside it.
    const order = [...raw].sort(
      (a, b) => b.end - b.start - (a.end - a.start) || a.start - b.start,
    );
    const kept: Raw[] = [];
    const shadowed = new Set<Raw>();
    for (const r of order) {
      if (kept.some((k) => overlaps(k, r))) shadowed.add(r);
      else kept.push(r);
    }

    const annotations = byPassage.get(passage.uuid) ?? [];
    const instances = annotations
      .filter((a) => a.type === 'glossary-instance')
      .map((a) => ({
        ...a,
        term: input.termOf.get(citedUuid(a) ?? '') ?? citedUuid(a),
      }));
    const blocking = annotations.filter(
      (a) =>
        a.type === 'inline-title' ||
        a.type === 'mantra' ||
        (a.type === 'span' && valueOf(a, 'text-style') === 'foreign'),
    );

    const ordinals = new Map<string, number>();
    for (const r of [...raw].sort(
      (a, b) => a.start - b.start || b.end - a.end,
    )) {
      const range = storedRange(searchable, r.start, r.end);
      const lower = r.text.toLowerCase();
      const fingerprint = contextFingerprint(
        passage.content,
        range.start,
        range.end,
      );
      // Identical text in an identical context is told apart by order alone.
      const ordinal = (ordinals.get(fingerprint) ?? 0) + 1;
      ordinals.set(fingerprint, ordinal);

      const [proposed, ...others] = r.entry.terms;
      const signals: MatchSignals = {
        form: proposed.kind,
        plural: r.plural,
        case: caseOf(r.surface, r.entry.form),
        homograph: others.length > 0,
        ordinaryWord: ORDINARY.test(r.entry.form),
        hyphenated:
          searchable.text[r.start - 1] === '-' ||
          searchable.text[r.end] === '-',
      };
      const match: GlossaryMatch = {
        key: `c-${stableHash(`${passage.uuid}|${lower}|${fingerprint}|${ordinal}`)}`,
        passageUuid: passage.uuid,
        termUuid: proposed.uuid,
        otherTermUuids: others.map((t) => t.uuid),
        start: range.start,
        end: range.end,
        text: r.text,
        matchedForm: r.entry.form,
        signals,
        tier: tierOf(signals),
        status: 'candidate',
      };

      const same = instances.find(
        (i) => i.start === range.start && i.end === range.end,
      );
      const exclude = (reason: ExclusionReason) => {
        match.status = 'excluded';
        match.reason = reason;
      };
      if (same && r.entry.terms.some((t) => t.uuid === same.term)) {
        match.status = 'existing';
        match.termUuid = same.term as string;
      } else if (same) exclude('existing-other-term');
      else if (shadowed.has(r)) exclude('overlaps-longer-match');
      else if (instances.some((i) => overlaps(i, range)))
        exclude('overlaps-existing');
      else if (isExcludedPassageType(passage.type)) exclude('passage-type');
      else if (passage.type === 'translation' && !passage.label?.trim())
        exclude('title-line');
      else {
        const block = blocking.find((b) => overlaps(b, range));
        if (block) {
          exclude(
            block.type === 'inline-title'
              ? 'inline-title'
              : block.type === 'mantra'
                ? 'mantra'
                : 'foreign',
          );
        }
      }
      out.push(match);
    }
  }
  return out;
};
