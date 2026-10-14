import {
  buildMatcher,
  formsOf,
  matchGlossaryInstances,
  tierOf,
  type GlossaryMatch,
  type MatchSignals,
} from './match';
import type {
  ResolveAnnotation,
  ResolveInput,
  ResolvePassage,
  ResolveTerm,
} from './read';

const term = (
  uuid: string,
  english: string | null,
  alternatives: string[] = [],
): ResolveTerm => ({
  uuid,
  authorityUuid: `a-${uuid}`,
  english,
  alternatives,
});

const passage = (
  uuid: string,
  content: string,
  extra: Partial<ResolvePassage> = {},
): ResolvePassage => ({
  uuid,
  content,
  label: '1.1',
  sort: 1,
  type: 'translation',
  ...extra,
});

const run = (
  passages: ResolvePassage[],
  terms: ResolveTerm[],
  annotations: ResolveAnnotation[] = [],
  termOf = new Map(terms.map((t) => [t.uuid, t.uuid])),
): GlossaryMatch[] =>
  matchGlossaryInstances({
    passages,
    terms,
    annotations,
    termOf,
  } as ResolveInput);

const texts = (matches: GlossaryMatch[], status = 'candidate') =>
  matches.filter((m) => m.status === status).map((m) => m.text);

describe('formsOf', () => {
  it('drops a leading article and keeps the english first', () => {
    expect(
      formsOf(term('t', 'The Blessed One', ['the Lord', 'Blessed One'])),
    ).toEqual([
      { form: 'Blessed One', kind: 'english' },
      { form: 'Lord', kind: 'alternative' },
    ]);
  });

  it('keeps an article that is the whole name', () => {
    expect(formsOf(term('t', 'the'))).toEqual([
      { form: 'the', kind: 'english' },
    ]);
  });
});

describe('matchGlossaryInstances', () => {
  const bodhisattva = term('b', 'bodhisattva');

  it('takes a plural inside the match and leaves a possessive outside', () => {
    const matches = run(
      [passage('p', 'bodhisattvas and a bodhisattva’s mind')],
      [bodhisattva],
    );
    expect(texts(matches)).toEqual(['bodhisattvas', 'bodhisattva']);
    expect(matches[0].signals.plural).toBe(true);
    expect(matches[1].end).toBe(30);
  });

  it('needs word boundaries, including for diacritics', () => {
    expect(
      texts(
        run(
          [passage('p', 'bodhisattvahood śrāvaka śrāvakaness')],
          [bodhisattva, term('s', 'śrāvaka')],
        ),
      ),
    ).toEqual(['śrāvaka']);
  });

  it('matches each part of a hyphenated compound and flags it', () => {
    const [m] = run([passage('p', 'bodhisattva-like')], [bodhisattva]);
    expect(m.text).toBe('bodhisattva');
    expect(m.signals.hyphenated).toBe(true);
  });

  it('matches across a soft hyphen and returns stored offsets', () => {
    const content = 'a bodhi­sattva';
    const [m] = run([passage('p', content)], [bodhisattva]);
    expect(m.text).toBe('bodhisattva');
    expect(content.slice(m.start, m.end)).toBe('bodhi­sattva');
  });

  it('matches multiword forms across line breaks', () => {
    expect(
      texts(
        run(
          [passage('p', 'the five\naggregates')],
          [term('f', 'five aggregates')],
        ),
      ),
    ).toEqual(['five\naggregates']);
  });

  it('prefers the longer match and reports the shorter one', () => {
    const matches = run(
      [passage('p', 'the perfection of wisdom')],
      [term('w', 'wisdom'), term('pw', 'perfection of wisdom')],
    );
    expect(texts(matches)).toEqual(['perfection of wisdom']);
    expect(matches.find((m) => m.text === 'wisdom')).toMatchObject({
      status: 'excluded',
      reason: 'overlaps-longer-match',
    });
  });

  it('marks a homograph for instance review and lists the other terms', () => {
    const [m] = run(
      [passage('p', 'Indra came')],
      [term('i1', 'Indra'), term('i2', 'Indra')],
    );
    expect(m.otherTermUuids).toHaveLength(1);
    expect(m.signals.homograph).toBe(true);
    expect(m.tier).toBe('instance');
  });

  it('proposes the term whose english it is over one with it as an alternative', () => {
    const [m] = run(
      [passage('p', 'Lord')],
      [term('z', 'Lord'), term('a', 'Blessed One', ['Lord'])],
    );
    expect(m.termUuid).toBe('z');
    expect(m.signals.form).toBe('english');
  });

  it('tiers from the match alone', () => {
    const matches = run(
      [passage('p', 'Mañjuśrī saw emptiness. Emptiness. EMPTINESS. the Lord')],
      [
        term('m', 'Mañjuśrī'),
        term('e', 'emptiness'),
        term('b', 'Blessed One', ['Lord']),
      ],
    );
    expect(matches.map((m) => [m.text, m.signals.case, m.tier])).toEqual([
      ['Mañjuśrī', 'exact', 'auto'],
      ['emptiness', 'exact', 'term'],
      ['Emptiness', 'initial', 'term'],
      ['EMPTINESS', 'other', 'instance'],
      ['Lord', 'exact', 'term'],
    ]);
  });

  it('tiers a title-cased lowercase form as an epithet, not an odd case', () => {
    const matches = run(
      [passage('p', 'The Blessed One and the BLESSED one')],
      [term('o', 'blessed one')],
    );
    expect(matches.map((m) => [m.text, m.signals.case, m.tier])).toEqual([
      ['Blessed One', 'title', 'term'],
      ['BLESSED one', 'other', 'instance'],
    ]);
  });

  it('reports existing instances, including those citing a child name', () => {
    const matches = run(
      [passage('p', 'a bodhisattva')],
      [bodhisattva],
      [
        {
          uuid: 'x',
          passageUuid: 'p',
          type: 'glossary-instance',
          start: 2,
          end: 13,
          content: [{ uuid: 'child' }],
        },
      ],
      new Map([
        ['b', 'b'],
        ['child', 'b'],
      ]),
    );
    expect(matches[0]).toMatchObject({ status: 'existing', termUuid: 'b' });
  });

  it('excludes matches the rules set aside, with a reason', () => {
    const matches = run(
      [
        passage('h', 'bodhisattva', { type: 'introductionHeader' }),
        passage('t', 'bodhisattva', { label: null }),
        passage(
          'p',
          'bodhisattva bodhisattva bodhisattva bodhisattva bodhisattva',
        ),
      ],
      [bodhisattva],
      [
        {
          uuid: '1',
          passageUuid: 'p',
          type: 'inline-title',
          start: 0,
          end: 11,
          content: [],
        },
        {
          uuid: '2',
          passageUuid: 'p',
          type: 'span',
          start: 12,
          end: 23,
          content: [{ 'text-style': 'foreign' }],
        },
        {
          uuid: '3',
          passageUuid: 'p',
          type: 'mantra',
          start: 24,
          end: 35,
          content: [],
        },
        {
          uuid: '4',
          passageUuid: 'p',
          type: 'glossary-instance',
          start: 36,
          end: 40,
          content: [{ uuid: 'b' }],
        },
        {
          uuid: '5',
          passageUuid: 'p',
          type: 'glossary-instance',
          start: 48,
          end: 59,
          content: [{ uuid: 'other' }],
        },
      ],
      new Map([
        ['b', 'b'],
        ['other', 'other'],
      ]),
    );
    expect(matches.map((m) => m.reason)).toEqual([
      'passage-type',
      'title-line',
      'inline-title',
      'foreign',
      'mantra',
      'overlaps-existing',
      'existing-other-term',
    ]);
  });

  it('keys a candidate by its surroundings, so an edit elsewhere in the passage keeps it', () => {
    const text =
      'Long ago, in a distant land, the realm of Indra, and after a long pause far away, where Indra dwells';
    const pad = ' and so on'.repeat(5);
    const before = run([passage('p', text)], [term('i', 'Indra')]);
    const after = run(
      [passage('p', `Indra came${pad}. ${text}`)],
      [term('i', 'Indra')],
    );
    expect(after.slice(1).map((m) => m.key)).toEqual(before.map((m) => m.key));
    const edited = run(
      [passage('p', text.replace('realm', 'world'))],
      [term('i', 'Indra')],
    );
    expect(edited[0].key).not.toBe(before[0].key);
    expect(edited[1].key).toBe(before[1].key);
  });

  it('scans past astral-plane characters', () => {
    expect(
      texts(run([passage('p', '𝔸 Indra 𝔸 Indra')], [term('i', 'Indra')])),
    ).toEqual(['Indra', 'Indra']);
  });

  it('keys a candidate by passage, text and ordinal, not by term', () => {
    const a = run([passage('p', 'Indra and Indra')], [term('i1', 'Indra')]);
    const b = run([passage('p', 'Indra and Indra')], [term('i2', 'Indra')]);
    expect(a.map((m) => m.key)).toEqual(b.map((m) => m.key));
    expect(new Set(a.map((m) => m.key)).size).toBe(2);
  });

  it('matches nothing without terms', () => {
    expect(buildMatcher([]).regex).toBeNull();
    expect(run([passage('p', 'text')], [])).toEqual([]);
  });
});

describe('tierOf', () => {
  const base: MatchSignals = {
    form: 'english',
    plural: false,
    case: 'exact',
    homograph: false,
    ordinaryWord: false,
    hyphenated: false,
  };
  it('auto-tiers only an unambiguous, non-ordinary english form', () => {
    expect(tierOf(base)).toBe('auto');
    expect(tierOf({ ...base, form: 'alternative' })).toBe('term');
    expect(tierOf({ ...base, ordinaryWord: true })).toBe('term');
    expect(tierOf({ ...base, homograph: true })).toBe('instance');
  });
});
