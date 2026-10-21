import { detectScript, ewtsSkeleton, tibetanSyllables } from './syllables';

const keys = (text: string) =>
  tibetanSyllables(text)
    .map((s) => s.key + (s.sanskrit ? '*' : ''))
    .join(' ');

describe('tibetanSyllables', () => {
  it.each([
    ['བཅོམ་ལྡན་འདས་ཀྱིས་བཀའ་སྩལ་པ།', 'bcom ldan ’das kyis bka’ stsal pa/'],
    ['པའི་མཐའ་ཡས་དབུས་གསུམ།', "pa'i mtha' yas dbus gsum/"],
    // Native stacks with and without `+`
    ['བཛྲ་ཀྲོ་དྷ', 'badz+ra kro d+ha'],
    // Fixed-form subjoined ya, and the fixed-form ra
    ['བཻ་ཌཱུཪྻ', 'bai DUR+Ya'],
    ['ཪྻ', 'R+Ya'],
    // Anusvara, visarga, retroflex and the vocalic r
    ['ཧཱུྃ་ཕཊ་ཨཱཿ་རྀ', 'hU~M phaT AH r-i'],
    // Shad placement and line breaks do not matter
    ['ཆོས་ཐམས་ཅད། །རང་བཞིན', 'chos thams\ncad rang bzhin/'],
  ])('%s reads as %s', (unicode, ewts) => {
    expect(keys(unicode)).toBe(keys(ewts));
  });

  it('folds retroflexes and drops the vowel a', () => {
    expect(keys('ཕཊ་པཱ་ཎི')).toBe('pht* p* ni*');
  });

  it('marks long vowels, retroflexes, fixed forms, anusvara, visarga and reversed i as Sanskrit', () => {
    for (const s of [
      'ཀཱ',
      'ཊ',
      'ཎ',
      'ཥ',
      'ཀྵ',
      'ཪ',
      'ཀྻ',
      'ཀྺ',
      'ཀྼ',
      'ཀཾ',
      'ཀཿ',
      'ཀྀ',
    ])
      expect(tibetanSyllables(s)[0].sanskrit).toBe(true);
    for (const s of [
      'bA',
      'Ta',
      'Na',
      'Sha',
      'Ra',
      'k+Ya',
      'kaM',
      'kaH',
      'k-i',
    ])
      expect(tibetanSyllables(s)[0].sanskrit).toBe(true);
    for (const s of ['ཀ', 'བསྒྲུབས', 'བཛྲ', 'bsgrubs', 'badz+ra'])
      expect(tibetanSyllables(s)[0].sanskrit).toBe(false);
  });

  it('gives an illegible or unreadable syllable no key', () => {
    expect(tibetanSyllables('bxa').map((s) => s.key)).toEqual(['']);
    // A vowel sign with no letter to carry it.
    expect(tibetanSyllables('ཀ་\u0f71').map((s) => s.key)).toEqual(['k', '']);
  });

  it('blanks rKTs code-point escapes without moving offsets', () => {
    const text = 'ka u0f7f kha';
    const found = tibetanSyllables(text);
    expect(found.map((s) => s.ewts)).toEqual(['ka', 'kha']);
    expect(text.slice(found[1].start, found[1].end)).toBe('kha');
  });

  it('gives positions in the input and EWTS with a plain a-chung', () => {
    const text = '༄༅། །འདས་པའི།';
    const found = tibetanSyllables(text);
    expect(found.map((s) => s.ewts)).toEqual(["'das", "pa'i"]);
    expect(found.map((s) => text.slice(s.start, s.end))).toEqual([
      'འདས',
      'པའི',
    ]);
  });
});

describe('ewtsSkeleton', () => {
  it('keeps M and H and flattens stacks', () => {
    expect(ewtsSkeleton('hU~M').key).toBe('huM');
    expect(ewtsSkeleton('sw+AH').key).toBe('swH');
    expect(ewtsSkeleton('a').key).toBe('a');
  });
});

describe('detectScript', () => {
  it('reads the first letter', () => {
    expect(detectScript('[F.1.a] ༄༅། །བཅོམ')).toBe('unicode');
    expect(detectScript('[F.1.a] bcom')).toBe('ewts');
  });
});
