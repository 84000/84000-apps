import type { GlossaryEntryName } from '@eightyfourthousand/data-access';

import {
  groupEntryNames,
  hasSameName,
  newName,
  type NameGroup,
} from './glossary-entry-names';

const name = (
  content: string,
  language: string,
  termType: string | null = null,
  contentTransformed: string | null = null,
): GlossaryEntryName => ({
  glossaryUuid: `g-${content}`,
  nameUuid: `n-${content}`,
  nameAuthorityUuid: 'a1',
  language,
  content,
  contentTransformed,
  termType,
  attestation: null,
});

const MAIN = name('Indra', 'en', 'translationMain');

const kinds = (groups: NameGroup[]) =>
  groups.map(({ kind, language }) => `${kind}:${language}`);

describe('groupEntryNames', () => {
  it('groups by language, alphabetically, the main name first', () => {
    const groups = groupEntryNames([
      MAIN,
      name('Śakra', 'Sa-Ltn'),
      name('lord of gods', 'en', 'translationAlternative'),
      name('brgya byin', 'Bo-Ltn', null, 'བརྒྱ་བྱིན།'),
      name('Devendra', 'Sa-Ltn'),
      name('Divine king', 'en', 'translationAlternative'),
      name('帝釋', 'zh'),
    ]);
    expect(kinds(groups)).toEqual([
      'main:en',
      'alternatives:en',
      'language:Bo-Ltn',
      'language:Sa-Ltn',
      'language:Pi-Ltn',
      'language:zh',
    ]);
    expect(groups[1].names.map((n) => n.content)).toEqual([
      'Divine king',
      'lord of gods',
    ]);
    expect(groups[3].names.map((n) => n.content)).toEqual([
      'Devendra',
      'Śakra',
    ]);
  });

  it('lists other languages under their code, after the rest', () => {
    const groups = groupEntryNames([
      MAIN,
      name('Taishakuten', 'ja'),
      name('Indra', 'de'),
    ]);
    expect(kinds(groups).slice(-2)).toEqual(['other:de', 'other:ja']);
  });

  it('lists any Chinese code with the Chinese names', () => {
    const groups = groupEntryNames([
      MAIN,
      name('帝釋天', 'Zh-Hant'),
      name('帝釋', 'zh'),
    ]);
    expect(groups.some((g) => g.kind === 'other')).toBe(false);
    expect(
      groups.find((g) => g.language === 'zh')?.names.map((n) => n.content),
    ).toEqual(['帝釋', '帝釋天']);
  });

  it('has no main group without an English main name, the root under its language', () => {
    const root = name('Śakra', 'Sa-Ltn');
    const groups = groupEntryNames([root, name('brgya byin', 'Bo-Ltn')]);
    expect(groups.some((g) => g.kind === 'main')).toBe(false);
    expect(groups.find((g) => g.language === 'Sa-Ltn')?.names).toEqual([root]);
  });
});

describe('hasSameName', () => {
  const groups = groupEntryNames([
    MAIN,
    name('Śakra', 'Sa-Ltn'),
    name('brgya byin', 'Bo-Ltn', null, 'བརྒྱ་བྱིན།'),
  ]);
  const sanskrit = groups.find((g) => g.language === 'Sa-Ltn') as NameGroup;
  const tibetan = groups.find((g) => g.language === 'Bo-Ltn') as NameGroup;

  it('matches the same text, whatever its case or spacing', () => {
    expect(
      hasSameName(sanskrit, { content: ' śakra ', contentTransformed: null }),
    ).toBe(true);
  });

  it('tells names apart by their diacritics', () => {
    expect(
      hasSameName(sanskrit, { content: 'Sakra', contentTransformed: null }),
    ).toBe(false);
  });

  it('compares Tibetan by its script', () => {
    expect(
      hasSameName(tibetan, {
        content: 'other wylie',
        contentTransformed: 'བརྒྱ་བྱིན།',
      }),
    ).toBe(true);
  });

  it('matches Tibetan by its Wylie when a stored name has no script', () => {
    const [, , bo] = groupEntryNames([MAIN, name('sems', 'Bo-Ltn')]);
    expect(
      hasSameName(bo, { content: 'sems', contentTransformed: 'སེམས།' }),
    ).toBe(true);
  });

  it('leaves out the name being edited', () => {
    const [own] = sanskrit.names;
    expect(
      hasSameName(
        sanskrit,
        { content: 'Śakra', contentTransformed: null },
        own,
      ),
    ).toBe(false);
  });
});

describe('newName', () => {
  it('makes an alternative an alternative, with no attestation', () => {
    const [, alternatives] = groupEntryNames([MAIN]);
    expect(newName(alternatives, ' lord ')).toEqual({
      language: 'en',
      content: 'lord',
      contentTransformed: null,
      termType: 'translationAlternative',
      attestation: null,
    });
  });

  it('keeps the script of a Tibetan name', () => {
    const tibetan = groupEntryNames([MAIN]).find(
      (g) => g.language === 'Bo-Ltn',
    ) as NameGroup;
    expect(newName(tibetan, 'sems', 'སེམས།')).toMatchObject({
      language: 'Bo-Ltn',
      content: 'sems',
      contentTransformed: 'སེམས།',
      termType: null,
    });
  });
});
