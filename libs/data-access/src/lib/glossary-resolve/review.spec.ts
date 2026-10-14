import { matchGlossaryInstances } from './match';
import { resolveAnchors, type GlossaryPlan } from './plan';
import type { ResolveAnnotation, ResolveInput, ResolveTerm } from './read';
import { contextFingerprint } from './text';
import { acceptedInstances, triageReview } from './review';
import {
  additionKey,
  type AuditSettings,
  type ReviewBatch,
  type ReviewDecider,
} from './review-batch';

const term = (uuid: string, english: string): ResolveTerm => ({
  uuid,
  authorityUuid: `a-${uuid}`,
  english,
  alternatives: [],
});

const planOf = (
  contents: string[],
  terms: ResolveTerm[],
  annotations: ResolveAnnotation[] = [],
): GlossaryPlan => {
  const input: ResolveInput = {
    passages: contents.map((content, i) => ({
      uuid: `p${i}`,
      content,
      label: `1.${i}`,
      sort: i,
      type: 'translation',
    })),
    annotations,
    terms,
    termOf: new Map(terms.map((t) => [t.uuid, t.uuid])),
  };
  return {
    workUuid: 'w',
    input,
    matches: matchGlossaryInstances(input),
    anchors: resolveAnchors(input),
    timings: { readMs: 0, matchMs: 0 },
  };
};

const matchOf = (p: GlossaryPlan, text: string) =>
  p.matches.find((m) => m.text === text) ?? p.matches[0];

let seq = 0;
const batch = (
  decider: ReviewDecider,
  parts: Partial<
    Pick<ReviewBatch, 'rules' | 'instances' | 'additions' | 'settings'>
  >,
): ReviewBatch => ({
  version: 1,
  batchId: `b${String(++seq).padStart(3, '0')}`,
  workUuid: 'w',
  recordedAt: `2026-10-13T00:00:${String(seq).padStart(2, '0')}.000Z`,
  recordedBy: 'u',
  decider,
  rules: [],
  instances: [],
  additions: [],
  ...parts,
});

/** An editor batch that only sets the audit. */
const audit = (settings: Partial<AuditSettings>) =>
  batch('editor', { settings });

const states = (plan: GlossaryPlan, batches: ReviewBatch[]) =>
  triageReview({ plan, batches }).items.map((i) => [i.text, i.state]);

describe('triageReview', () => {
  const lord = term('lord', 'lord');
  const plan = planOf(['the lord of death met the lord'], [lord]);
  const [first] = plan.matches;

  it('leaves candidates undecided without decisions', () => {
    expect(states(plan, [])).toEqual([
      ['lord', 'undecided'],
      ['lord', 'undecided'],
    ]);
  });

  it('applies the most specific rule, so a context rule beats a term rule', () => {
    const batches = [
      batch('editor', {
        rules: [
          { termUuid: 'lord', verdict: 'accept' },
          { termUuid: 'lord', verdict: 'skip', followedBy: 'of  Death' },
        ],
      }),
    ];
    expect(states(plan, batches)).toEqual([
      ['lord', 'skipped'],
      ['lord', 'accepted'],
    ]);
  });

  it('decides a whole tier with one rule', () => {
    expect(
      states(plan, [
        batch('editor', { rules: [{ tier: 'term', verdict: 'accept' }] }),
      ]),
    ).toEqual([
      ['lord', 'accepted'],
      ['lord', 'accepted'],
    ]);
  });

  it('lets an instance decision beat a rule, and an editor beat the model', () => {
    const batches = [
      audit({ sampleSize: 0 }),
      batch('editor', { rules: [{ termUuid: 'lord', verdict: 'accept' }] }),
      batch('editor', { instances: [{ key: first.key, verdict: 'skip' }] }),
      batch('model', { instances: [{ key: first.key, verdict: 'accept' }] }),
    ];
    expect(states(plan, batches)).toEqual([
      ['lord', 'skipped'],
      ['lord', 'accepted'],
    ]);
  });

  it('holds model decisions until the term sample is checked', () => {
    const model = batch('model', {
      rules: [{ termUuid: 'lord', verdict: 'accept' }],
    });
    const settings = audit({ sampleSize: 1 });
    const triage = triageReview({ plan, batches: [settings, model] });
    expect(triage.items.map((i) => i.state)).toEqual([
      'awaiting-sample',
      'awaiting-sample',
    ]);
    const sample = triage.samples.get('lord');
    expect(sample).toMatchObject({
      modelDecided: 2,
      checked: 0,
      errors: 0,
      status: 'pending',
    });

    const check = batch('editor', {
      instances: [{ key: sample?.keys[0] ?? '', verdict: 'accept' }],
    });
    expect(
      triageReview({ plan, batches: [settings, model, check] }).items.map(
        (i) => i.state,
      ),
    ).toEqual(['accepted', 'accepted']);
  });

  it('sends a term back when editor verdicts disagree with the model too often', () => {
    const batches = [
      audit({ sampleSize: 2, maxSampleErrors: 0 }),
      batch('model', { rules: [{ termUuid: 'lord', verdict: 'accept' }] }),
      batch('editor', { instances: [{ key: first.key, verdict: 'skip' }] }),
    ];
    const triage = triageReview({ plan, batches });
    expect(triage.samples.get('lord')).toMatchObject({
      errors: 1,
      status: 'sent-back',
    });
    expect(triage.items.map((i) => i.state)).toEqual([
      'skipped',
      'needs-editor',
    ]);
  });

  it('overrides the term and the span of an accepted candidate', () => {
    const p = planOf(
      ['the spirit of awakening'],
      [term('a', 'awakening'), term('s', 'spirit')],
    );
    const awakening = matchOf(p, 'awakening');
    const spirit = matchOf(p, 'spirit');
    const triage = triageReview({
      plan: p,
      batches: [
        batch('editor', {
          instances: [
            {
              key: awakening.key,
              verdict: 'accept',
              span: 'spirit of awakening',
            },
            { key: spirit.key, verdict: 'skip' },
          ],
        }),
      ],
    });
    expect(triage.items[1]).toMatchObject({
      state: 'accepted',
      start: 4,
      end: 23,
      overridden: 'span',
      termUuid: 'a',
    });

    const termOverride = triageReview({
      plan: p,
      batches: [
        batch('editor', {
          instances: [{ key: spirit.key, verdict: 'accept', termUuid: 'a' }],
        }),
      ],
    });
    expect(termOverride.items[0]).toMatchObject({
      termUuid: 'a',
      overridden: 'term',
      state: 'accepted',
    });
  });

  it('reports a span that no longer anchors, and decisions on vanished keys, as orphans', () => {
    const triage = triageReview({
      plan,
      batches: [
        batch('editor', {
          instances: [
            { key: first.key, verdict: 'accept', span: 'king of death' },
            { key: 'c-gone', verdict: 'accept' },
          ],
          additions: [{ passageUuid: 'p0', text: 'nowhere', termUuid: 'lord' }],
        }),
      ],
    });
    expect(triage.orphans.map((o) => o.key).sort()).toEqual(
      [
        first.key,
        'c-gone',
        additionKey({ passageUuid: 'p0', text: 'nowhere', termUuid: 'lord' }),
      ].sort(),
    );
  });

  it('adds a missed instance by its text', () => {
    const p = planOf(['the Lord‑of‑Death'], [term('d', 'death'), lord]);
    const triage = triageReview({
      plan: p,
      batches: [
        batch('editor', {
          additions: [
            { passageUuid: 'p0', text: 'Lord‑of‑Death', termUuid: 'd' },
          ],
        }),
      ],
    });
    const added = triage.items.find((i) => i.source === 'addition');
    expect(added).toMatchObject({
      state: 'accepted',
      start: 4,
      end: 17,
      termUuid: 'd',
    });
  });

  it('flags accepted items that overlap, and applies neither', () => {
    const p = planOf(
      ['the spirit of awakening'],
      [term('a', 'awakening'), term('s', 'spirit')],
    );
    const awakening = matchOf(p, 'awakening');
    const triage = triageReview({
      plan: p,
      batches: [
        batch('editor', {
          rules: [{ termUuid: 's', verdict: 'accept' }],
          instances: [
            {
              key: awakening.key,
              verdict: 'accept',
              span: 'spirit of awakening',
            },
          ],
        }),
      ],
    });
    expect(triage.conflicts).toHaveLength(2);
    expect(acceptedInstances(p, triage)).toEqual([]);
  });

  it('shows stored instances as applied and keeps their decisions from becoming orphans', () => {
    const p = planOf(
      ['the lord'],
      [lord],
      [
        {
          uuid: 'x',
          passageUuid: 'p0',
          type: 'glossary-instance',
          start: 4,
          end: 8,
          content: [{ uuid: 'lord' }],
        },
      ],
    );
    const triage = triageReview({
      plan: p,
      batches: [
        batch('editor', {
          instances: [{ key: p.matches[0].key, verdict: 'accept' }],
        }),
      ],
    });
    expect(triage.items[0].state).toBe('applied');
    expect(triage.orphans).toEqual([]);
  });

  it('can accept an excluded candidate by instance, not by rule', () => {
    const p = planOf(
      ['the lord'],
      [lord],
      [
        {
          uuid: 'x',
          passageUuid: 'p0',
          type: 'mantra',
          start: 4,
          end: 8,
          content: [],
        },
      ],
    );
    expect(
      states(p, [
        batch('editor', { rules: [{ termUuid: 'lord', verdict: 'accept' }] }),
      ]),
    ).toEqual([['lord', 'undecided']]);
    expect(
      states(p, [
        batch('editor', {
          instances: [{ key: p.matches[0].key, verdict: 'accept' }],
        }),
      ]),
    ).toEqual([['lord', 'accepted']]);
  });
});

describe('acceptedInstances', () => {
  it('returns accepted items in scope with their authority', () => {
    const p = planOf(
      ['the lord and death'],
      [term('lord', 'lord'), term('d', 'death')],
    );
    const triage = triageReview({
      plan: p,
      batches: [
        batch('editor', { rules: [{ tier: 'term', verdict: 'accept' }] }),
      ],
    });
    expect(acceptedInstances(p, triage, { termUuids: ['d'] })).toEqual([
      {
        key: p.matches[1].key,
        passageUuid: 'p0',
        start: 13,
        end: 18,
        text: 'death',
        termUuid: 'd',
        authorityUuid: 'a-d',
      },
    ]);
  });
});

describe('triageReview decisions', () => {
  const lord = term('lord', 'lord');
  const stored = (
    start: number,
    end: number,
    glossary: string,
  ): ResolveAnnotation => ({
    uuid: `x${start}`,
    passageUuid: 'p0',
    type: 'glossary-instance',
    start,
    end,
    content: [{ uuid: glossary }],
  });

  it('never lets a term rule cover the instance tier', () => {
    const p = planOf(['the lord'], [lord, term('other', 'lord')]);
    const [m] = p.matches.filter((x) => x.termUuid === 'lord');
    expect(m.tier).toBe('instance');
    const rule = (tier?: 'instance' | 'term') =>
      triageReview({
        plan: p,
        batches: [
          batch('editor', {
            rules: [{ termUuid: 'lord', verdict: 'accept', tier }],
          }),
        ],
      }).items.find((i) => i.key === m.key)?.state;
    expect(rule()).toBe('undecided');
    expect(rule('term')).toBe('undecided');
    expect(rule('instance')).toBe('accepted');
  });

  it('matches a context rule on word boundaries only', () => {
    const p = planOf(['the lord of deathless and the lord of death'], [lord]);
    expect(
      states(p, [
        batch('editor', {
          rules: [
            { termUuid: 'lord', verdict: 'skip', followedBy: 'of death' },
          ],
        }),
      ]),
    ).toEqual([
      ['lord', 'undecided'],
      ['lord', 'skipped'],
    ]);
  });

  it("ranks an editor's rule above the model's instance decision", () => {
    const p = planOf(['the lord'], [lord]);
    const triage = triageReview({
      plan: p,
      batches: [
        audit({ sampleSize: 0 }),
        batch('model', {
          instances: [{ key: p.matches[0].key, verdict: 'skip' }],
        }),
        batch('editor', { rules: [{ termUuid: 'lord', verdict: 'accept' }] }),
      ],
    });
    expect(triage.items[0]).toMatchObject({
      state: 'accepted',
      decider: 'editor',
      source: 'rule',
    });
  });

  it('orphans a span override that is not at its candidate', () => {
    const p = planOf(
      [`the lord ${'and so on '.repeat(6)}king of death`],
      [lord],
    );
    const triage = triageReview({
      plan: p,
      batches: [
        batch('editor', {
          instances: [
            { key: p.matches[0].key, verdict: 'accept', span: 'king of death' },
          ],
        }),
      ],
    });
    expect(triage.items[0].state).toBe('undecided');
    expect(triage.orphans[0].reason).toMatch(/not at the candidate/);
  });

  it('counts an override equal to the proposal as no override in the audit', () => {
    const p = planOf(['the lord'], [lord]);
    const key = p.matches[0].key;
    const triage = triageReview({
      plan: p,
      batches: [
        audit({ sampleSize: 1, maxSampleErrors: 0 }),
        batch('model', { instances: [{ key, verdict: 'accept' }] }),
        batch('editor', {
          instances: [
            { key, verdict: 'accept', termUuid: 'lord', span: 'lord' },
          ],
        }),
      ],
    });
    expect(triage.samples.get('lord')).toMatchObject({
      errors: 0,
      status: 'passed',
    });
    expect(triage.items[0].overridden).toBeUndefined();
  });

  it('holds a skip by the model in a term sent back, as needs-editor', () => {
    const p = planOf(['the lord met the lord'], [lord]);
    const [a, b] = p.matches;
    const triage = triageReview({
      plan: p,
      batches: [
        audit({ sampleSize: 2, maxSampleErrors: 0 }),
        batch('model', {
          instances: [
            { key: a.key, verdict: 'skip' },
            { key: b.key, verdict: 'skip' },
          ],
        }),
        batch('editor', { instances: [{ key: a.key, verdict: 'accept' }] }),
      ],
    });
    expect(triage.items.map((i) => i.state)).toEqual([
      'accepted',
      'needs-editor',
    ]);
  });

  it("audits the model's additions with its other decisions on the term", () => {
    const p = planOf(['the Lord‑of‑Death'], [term('d', 'death'), lord]);
    const added = {
      passageUuid: 'p0',
      text: 'Lord‑of‑Death',
      termUuid: 'd',
    };
    const model = batch('model', { additions: [added] });
    const triage = triageReview({
      plan: p,
      batches: [audit({ sampleSize: 5 }), model],
    });
    const key = additionKey(added);
    expect(triage.items.find((i) => i.key === key)?.state).toBe(
      'awaiting-sample',
    );
    expect(triage.samples.get('d')?.keys).toContain(key);

    const checked = triageReview({
      plan: p,
      batches: [
        audit({ sampleSize: 5 }),
        model,
        batch('editor', {
          instances: [
            ...(triage.samples.get('d')?.keys ?? []).map((k) => ({
              key: k,
              verdict: 'accept' as const,
            })),
          ],
        }),
      ],
    });
    expect(checked.items.find((i) => i.key === key)?.state).toBe('accepted');
  });

  it("never lets the model's addition replace an editor's", () => {
    const p = planOf(['the Lord‑of‑Death'], [term('d', 'death'), lord]);
    const triage = triageReview({
      plan: p,
      batches: [
        batch('editor', {
          additions: [
            { passageUuid: 'p0', text: 'Lord‑of‑Death', termUuid: 'd' },
          ],
        }),
        batch('model', {
          additions: [
            { passageUuid: 'p0', text: 'Lord‑of‑Death', termUuid: 'lord' },
          ],
        }),
      ],
    });
    expect(triage.items.find((i) => i.source === 'addition')).toMatchObject({
      termUuid: 'd',
      decider: 'editor',
    });
  });

  it('orphans an addition whose surroundings changed', () => {
    const p = planOf(['the lord of death'], [lord]);
    const triage = triageReview({
      plan: p,
      batches: [
        batch('editor', {
          additions: [
            {
              passageUuid: 'p0',
              text: 'lord of death',
              termUuid: 'lord',
              fingerprint: contextFingerprint('a lord of death', 2, 15),
            },
          ],
        }),
      ],
    });
    expect(triage.orphans[0].reason).toMatch(/changed/);
  });

  it('shows an accepted span already stored with its term as applied, and with another term as a conflict', () => {
    const p = planOf(['the lord'], [lord, term('k', 'king')]);
    const accept = (annotations: ResolveAnnotation[]) => {
      const plan = { ...p, input: { ...p.input, annotations } };
      return triageReview({
        plan,
        batches: [
          batch('editor', {
            instances: [{ key: p.matches[0].key, verdict: 'accept' }],
          }),
        ],
      });
    };
    expect(accept([stored(4, 8, 'lord')]).items[0].state).toBe('applied');
    const other = accept([stored(4, 8, 'k')]);
    expect(other.items[0].state).toBe('conflict');
    expect(other.conflicts[0].reason).toMatch(/another term/);
    expect(accept([stored(0, 6, 'k')]).items[0].state).toBe('conflict');
  });
});
