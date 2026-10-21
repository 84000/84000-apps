import { toEwts, toEwtsWithWarnings, type FinalShad } from './ewts';

const A_CHUNG = '’';

describe('toEwts', () => {
  // Every example in shared-policies/transliteration, with its Unicode.
  describe('house profile examples', () => {
    it.each<[string, string, FinalShad]>([
      // 1. The a-chung
      ['འདས', '’das', 'keep'],
      ['པའི', 'pa’i', 'keep'],
      // 3. The final shad, dropped after a title, term or name
      ['ལྕང་ལོ་ཅན།', 'lcang lo can', 'drop'],
      [
        'ཕྱག་ན་རྡོ་རྗེ་གསང་བ་བསྟན་པ།',
        'phyag na rdo rje gsang ba bstan pa',
        'drop',
      ],
      // 3. ...and kept inside a quoted passage, with an ordinary space for `_`
      ['བསྒྱུར་བའོ། །སླད་ཀྱིས', 'bsgyur ba’o/ /slad kyis', 'keep'],
      // 4. Sanskrit in Tibetan script: explicit stacking and Sanskrit marks
      ['\u0f57', 'b+ha', 'keep'],
      ['\u0f56\u0fb7', 'b+ha', 'keep'],
      ['ཏནྟྲ', 'tan+t+ra', 'keep'],
      ['ཙྪ', 'ts+tsha', 'keep'],
      ['ཤྃ', 'sha~M', 'keep'],
      ['ཧཱུྃ', 'hU~M', 'keep'],
      ['བཱན', 'bAn', 'keep'],
      ['པཱ་ཎི', 'pA Ni', 'keep'],
      // 4. ...but a stack that is also native is written as native
      ['བཛྲ', 'badzra', 'keep'],
      ['བསྒྲུབ', 'bsgrub', 'keep'],
      // 2. Volume information in a reference: italics are not ours, the text is
      ['རྒྱུད་འབུམ', 'rgyud ’bum', 'keep'],
    ])('%s -> %s (%s)', (unicode, ewts, finalShad) => {
      expect(toEwts(unicode, { finalShad })).toBe(ewts);
    });
  });

  describe('the a-chung', () => {
    it('is always U+2019, never a straight or opening quote', () => {
      const ewts = toEwts('འཇམ་དཔལ་ཡེ་ཤེས་སེམས་དཔའི་མཁའ་འགྲོ་བའོ་མིའམ');
      expect(ewts).toBe('’jam dpal ye shes sems dpa’i mkha’ ’gro ba’o mi’am');
      expect(ewts).not.toMatch(/['‘]/);
    });

    it('as a subjoined letter too', () => {
      expect(toEwts('\u0f40\u0fb0')).toBe(`k+${A_CHUNG}a`);
    });

    it('leaves apostrophes outside Tibetan alone', () => {
      expect(toEwts("Toh 1 'dul ba, འདུལ་བ")).toBe("Toh 1 'dul ba, ’dul ba");
    });
  });

  describe('native syllables', () => {
    it.each([
      ['བརྒྱ', 'brgya'],
      ['བཀྲ་ཤིས', 'bkra shis'],
      ['དག', 'dag'],
      ['དགའ', 'dga’'],
      ['དགའི', 'dga’i'],
      ['དབུའི', 'dbu’i'],
      ['དབྱངས', 'dbyangs'],
      ['གངས', 'gangs'],
      ['གནད', 'gnad'],
      ['བགས', 'bags'],
      ['མངས', 'mangs'],
      ['དངས', 'dangs'],
      ['དམས', 'dmas'],
      ['ལེའུར', 'le’ur'],
      ['ཁྱེའུས', 'khye’us'],
      ['གཡག', 'g.yag'],
      ['གཡོ', 'g.yo'],
      ['སངས་རྒྱས', 'sangs rgyas'],
      ['བྱང་ཆུབ་སེམས་དཔའ', 'byang chub sems dpa’'],
      ['སྤྱན་རས་གཟིགས', 'spyan ras gzigs'],
      ['ཞྭ་རྩྭ་ཕྱྭ་གྲྭ', 'zhwa rtswa phywa grwa'],
      ['བཟླས་ལྷ་ཀླུའི', 'bzlas lha klu’i'],
      ['ཁྱེའུ', 'khye’u'],
      ['ཨང་ཨོཾ', 'ang oM'],
    ])('%s -> %s', (unicode, ewts) => {
      expect(toEwts(unicode)).toBe(ewts);
    });
  });

  describe('Sanskrit', () => {
    it.each([
      ['པདྨ', 'pad+ma'],
      ['ཀརྨ', 'karma'],
      ['དྷརྨ', 'd+harma'],
      ['\u0f69', 'k+Sha'],
      ['\u0f40\u0fb5', 'k+Sha'],
      ['ཛྙཱ་ན', 'dz+nyA na'],
      ['མཉྫུ་ཤྲཱི', 'many+dzu shrI'],
      ['ཏྭསྱ', 'twas+ya'],
      ['བུདྡྷོ', 'bud+d+ho'],
      ['ཏཱིཀྵྞ', 'tIk+Sh+Na'],
      ['དུཿཁ', 'duHkha'],
      ['ཧྲྀ', 'hr-i'],
      ['ཏ྄', 'ta?'],
      ['\u0f68\u0f76', 'a+r-i'],
      ['\u0f68\u0fb2\u0f80', 'a+r-i'],
      ['\u0f40\u0f76', 'kr-i'],
      ['\u0f55\u0f39', 'fa'],
      ['ནཱཾ', 'nAM'],
      ['ཨ་ཨཱ་ཨི་ཨཱི་ཨུ་ཨཱུ་ཨེ་ཨཻ་ཨོ་ཨཽ་ཨཾ་ཨཿ', 'a A i I u U e ai o au aM aH'],
    ])('%s -> %s', (unicode, ewts) => {
      expect(toEwts(unicode)).toBe(ewts);
    });

    it('uses capitals only for Sanskrit letters and long vowels', () => {
      expect(toEwts('ལྕང་ལོ་ཅན་རྡོ་རྗེ')).toBe(
        toEwts('ལྕང་ལོ་ཅན་རྡོ་རྗེ').toLowerCase(),
      );
    });
  });

  describe('shads and punctuation', () => {
    it('keeps the final shad by default', () => {
      expect(toEwts('ལྕང་ལོ་ཅན།')).toBe('lcang lo can/');
    });

    it('drops trailing shads, tshegs and spaces with finalShad drop', () => {
      expect(toEwts('ལྕང་ལོ་ཅན་།། ', { finalShad: 'drop' })).toBe(
        'lcang lo can',
      );
      expect(toEwts('ཅན་', { finalShad: 'drop' })).toBe('can');
    });

    it('drops only the end, not a shad inside', () => {
      expect(toEwts('ཀ། །ཁ།', { finalShad: 'drop' })).toBe('ka/ /kha');
    });

    it('writes the space after a shad as a space, never _', () => {
      expect(toEwts('ཞིང་། །གཉིས་སུ།། །།')).toBe('zhing / /gnyis su// //');
    });

    it('converts the opening marks, tsheg and digits', () => {
      expect(toEwts('༄༅། །རྒྱ་གར་སྐད་དུ། ༡༢')).toBe(
        '@#/ /rgya gar skad du/ 12',
      );
    });

    it('passes non-Tibetan text and line breaks through', () => {
      expect(toEwts('F.1.b ཀ་ཁ\nF.2.a ག')).toBe('F.1.b ka kha\nF.2.a ga');
    });
  });

  describe('warnings', () => {
    it('escapes a Tibetan character with no EWTS form and says so', () => {
      const result = toEwtsWithWarnings('ཀ༓');
      expect(result.ewts).toBe('ka\\u0F13');
      expect(result.warnings).toHaveLength(1);
    });

    it('escapes a vowel sign with no letter', () => {
      const result = toEwtsWithWarnings('ི');
      expect(result.ewts).toBe('\\u0F72');
      expect(result.warnings).toHaveLength(1);
    });

    it('flags an a-chen carrying a vowel inside a syllable', () => {
      const result = toEwtsWithWarnings('ཀཨི');
      expect(result.ewts).toBe('kai');
      expect(result.warnings).toHaveLength(1);
      expect(toEwtsWithWarnings('ཀཻ').warnings).toEqual([]);
    });

    it('has none for ordinary text', () => {
      expect(toEwtsWithWarnings('བསྒྱུར་བའོ། །').warnings).toEqual([]);
    });
  });

  it('gives the same string as toEwtsWithWarnings', () => {
    const text = 'ཨོཾ་བཛྲ་ཏཱིཀྵྞ་དུཿཁ་ཙྪེ་ད།';
    expect(toEwts(text)).toBe(toEwtsWithWarnings(text).ewts);
  });
});
