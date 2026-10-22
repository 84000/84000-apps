import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from './cli';
import {
  openCorpus,
  readSides,
  readWitnesses,
  witnessesAt,
} from './tibetan/corpus';
import { findMatches, probeFromPhrases } from './tibetan/match';

// One passage, in Degé Unicode and in rKTs-style EWTS.
const PASSAGE_BO =
  'བཅོམ་ལྡན་འདས་ཀྱིས་བཀའ་སྩལ་པ། རིགས་ཀྱི་བུ་ཁྱོད་ཀྱིས་ལེགས་པར་ཉོན་ལ་ཡིད་ལ་ཟུངས་ཤིག';
const PASSAGE_WY =
  "bcom ldan 'das kyis bka' stsal pa/ rigs kyi bu khyod kyis legs par nyon la yid la zungs shig";
const MANTRA_BO =
  'ཨོཾ་བཛྲ་ཀྲོ་དྷ་ཧཱུྃ་ཧཱུྃ་ཕཊ་ཕཊ་སྭཱ་ཧཱ། ཨོཾ་བཛྲ་ཀྲོ་དྷ་ཧཱུྃ་ཧཱུྃ་ཕཊ་ཕཊ་སྭཱ་ཧཱ།';
const MANTRA_WY =
  'oM badz+ra kro d+ha hU~M hU~M phaT phaT swA hA/ oM badz+ra kro d+ha hU~M hU~M phaT phaT swA hA/';
const FILLER_BO = 'ཆོས་ཐམས་ཅད་རང་བཞིན་གྱིས་སྟོང་པ་སྟེ། ';
const REFRAIN_BO =
  'དེ་ནས་དེ་བཞིན་གཤེགས་པ་ཐམས་ཅད་ཀྱི་སྐུ་གསུང་ཐུགས་རྡོ་རྗེ་ལ་ཕྱག་འཚལ་ལོ། ';
const BERYL_BO =
  'རིན་པོ་ཆེ་བཻ་ཌཱུཪྻ་ལས་བྱས་པའི་ཁང་པ་བརྩེགས་པ་མཛེས་པ་ཞིག་ཡོད་དོ།';
const BERYL_WY =
  "rin po che bai DUR+Ya las byas pa'i khang pa brtsegs pa mdzes pa zhig yod do/";

const WORKS = [
  'collection\tsiglum_number\tconceptual_work\ttoh\ttitle_bo\ttitle_sa\ttitle_en\tsection_title\tstart_vol\tstart_folio\tend_vol\tend_folio\tboundary_status\tpage_start',
  'kangyur/D\tD1\tc1\ttoh1\troot text\t\t\t\t1\tF.1.b\t1\tF.2.a\treference',
  'kangyur/D\tD2\tc2\ttoh2\tnext text\t\t\t\t1\tF.2.a\t1\tF.2.b\treference',
  'kangyur/D\tD3\tc3\ttoh3\tshort start\t\t\t\t2\tF.1.b\t2\tF.2.a\treference',
  'tengyur/D\tD9\tc9\ttoh9\tcommentary\t\t\t\t1\tF.1.a\t1\tF.3.b\treference',
  'tengyur/D\tD8\tc8\ttoh8\tsecond commentary\t\t\t\t1\tF.4.a\t1\tF.5.a\treference',
  'kangyur/S\tS1\tc1\ttoh1\troot text\t\t\t\t1\tF.5.a\t1\tF.7.a\tanchored',
  // Volume 2 numbers its folios afresh for the second text.
  'kangyur/X\tX10\tc10\ttoh10\tlong text\t\t\t\t1\tF.1.b\t2\tF.5.b\treference',
  'kangyur/X\tX11\tc11\ttoh11\tnext text\t\t\t\t2\tF.1.b\t2\tF.2.b\treference',
  // Volume 3 restarts its numbering inside its last text, X13.
  'kangyur/X\tX12\tc12\ttoh12\tshort text\t\t\t\t3\tF.1.b\t3\tF.5.b\treference',
  'kangyur/X\tX13\tc13\ttoh13\tlast text\t\t\t\t3\tF.5.b\t3\tF.12.a\treference',
  // Sorted by folio, as catalogs are: Y3 is read after Y2, on a later page.
  'kangyur/Y\tY1\tc21\ttoh21\tfirst\t\t\t\t1\tF.1.b\t1\tF.5.b\treference\t2',
  'kangyur/Y\tY3\tc23\ttoh23\tthird\t\t\t\t1\tF.1.b\t1\tF.4.b\treference\t23',
  'kangyur/Y\tY2\tc22\ttoh22\tsecond\t\t\t\t1\tF.5.b\t1\tF.10.b\treference\t10',
].join('\n');

const LONG_BO = 'ཁྲི་བརྒྱད་སྟོང་པ་ཡི་དགེ། ';
const NEXT_BO = 'ཁྲི་པ་ཞེས་བྱ་བ་ཡི་དགེ། ';

describe('eft', () => {
  let dir: string;
  const at = (...parts: string[]) => join(dir, ...parts);
  const collection = (c: string) => at('etexts', 'text', ...c.split('/'));
  const write = (path: string, text: string) => {
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, text);
  };
  const cli = (...args: string[]) => {
    let stdout = '';
    let stderr = '';
    const code = run(args, {
      stdout: (t) => (stdout += t),
      stderr: (t) => (stderr += t),
      now: () => 0,
    });
    return { code, stdout, stderr };
  };
  const jsonl = (path: string) =>
    readFileSync(path, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'eft-'));
    write(at('etexts', 'catalog', 'works.tsv'), `${WORKS}\n`);
    write(at('etexts', 'manifest.json'), '{"buildId":"test"}');
    write(
      join(collection('kangyur/D'), '001.txt'),
      [
        `[F.1.a] ${FILLER_BO}`,
        `[F.1.b] ${FILLER_BO}༄༅། །རྒྱ་གར་སྐད་དུ། ${MANTRA_BO} ${PASSAGE_BO}`,
        `[F.2.a] ${FILLER_BO.repeat(2)}༄༅། །རྒྱ་གར་སྐད་དུ། ཐ་མ`,
        `[F.2.b] ${FILLER_BO}`,
      ].join('\n') + '\n',
    );
    write(
      join(collection('kangyur/D'), '002.txt'),
      [
        `[F.1.a] ${FILLER_BO}`,
        `[F.1.b] ${FILLER_BO}རྫོགས་སོ།། ༄༅། །རྒྱ་གར་སྐད་དུ། ཆུང་ངུ། རྫོགས་སོ།། ༄༅། །རྒྱ་གར་སྐད་དུ། གཞུང་། ${PASSAGE_BO}`,
        `[F.2.a] ${FILLER_BO}༄༅། །རྒྱ་གར་སྐད་དུ། ཐ་མ`,
      ].join('\n') + '\n',
    );
    // The passage runs across a folio break, with different punctuation; a
    // second text quotes a refrain from its second time in the root, on an
    // unnumbered side.
    const cut = PASSAGE_BO.split('་', 8).join('་').length + 1;
    const [head, tail] = [PASSAGE_BO.slice(0, cut), PASSAGE_BO.slice(cut)];
    write(
      join(collection('tengyur/D'), '001.txt'),
      [
        `[F.1.a] ${FILLER_BO}`,
        `[F.2.b] ${MANTRA_BO} ཞེས་སོ། །དེ་ལས། ${head}`,
        `[F.3.a] ${tail.replace('། ', '་')} ཞེས་གསུངས་སོ།`,
        `[F.4.a] ལོ་རྒྱུས་གཞན་ཞིག་བཤད་པར་བྱའོ། `,
        `[F.?] ཞེས་སོ། །${REFRAIN_BO}${PASSAGE_BO} ཞེས་སོ།`,
      ].join('\n') + '\n',
    );
    write(
      join(collection('kangyur/S'), '001.txt'),
      `[F.5.a] ${MANTRA_WY} ${PASSAGE_WY}\n[F.6.a] zhes so/\n[F.7.a] ${BERYL_WY}\n`,
    );
    write(
      join(collection('kangyur/X'), '001.txt'),
      `[F.1.a] ${FILLER_BO}\n[F.1.b] རྒྱ་གར་སྐད་དུ། ${LONG_BO}\n[F.2.a] ${LONG_BO}\n`,
    );
    write(
      join(collection('kangyur/X'), '002.txt'),
      [
        ...[
          '1.a',
          '1.b',
          '2.a',
          '2.b',
          '3.a',
          '3.b',
          '4.a',
          '4.b',
          '5.a',
          '5.b',
        ].map((f) => `[F.${f}] ${LONG_BO}`),
        '[F.1.a] ',
        `[F.1.b] རྒྱ་གར་སྐད་དུ། ${NEXT_BO}`,
        `[F.2.a] ${NEXT_BO}`,
        `[F.2.b] ${NEXT_BO}`,
      ].join('\n') + '\n',
    );
    write(
      join(collection('kangyur/X'), '003.txt'),
      [...Array(12).keys(), ...Array(4).keys()]
        .map((i) => `[F.${i + 1}.a] ${FILLER_BO}`)
        .join('\n') + '\n',
    );
    write(
      join(collection('kangyur/Y'), '001.txt'),
      [...Array(10).keys(), ...Array(4).keys()]
        .flatMap((i) => [
          `[F.${i + 1}.a] ${FILLER_BO}`,
          `[F.${i + 1}.b] ${FILLER_BO}`,
        ])
        .join('\n') + '\n',
    );
    write(
      at('refrain-root.txt'),
      `[F.1.a] ${REFRAIN_BO}${FILLER_BO.repeat(3)}\n[F.1.b] ${REFRAIN_BO}${PASSAGE_BO}\n[F.2.a] ${BERYL_BO}\n`,
    );
  });

  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  describe('extract', () => {
    it('gives a witness trimmed at the neighbouring texts', () => {
      const out = at('scratch', 'toh1', 'root.txt');
      const { code } = cli(
        'extract',
        collection('kangyur/D'),
        'toh1',
        '--out',
        out,
      );
      expect(code).toBe(0);
      const text = readFileSync(out, 'utf8');
      expect(text.startsWith('[F.1.b] རྒྱ་གར་སྐད་དུ།')).toBe(true);
      expect(text).toContain('[F.2.a]');
      expect(text).not.toContain('ཐ་མ');
      expect(text).not.toContain('[F.2.b]');
    });

    it('skips a short text that opens and closes on the first side', () => {
      const { stdout } = cli('extract', collection('kangyur/D'), 'toh3');
      expect(stdout.startsWith('[F.1.b] རྒྱ་གར་སྐད་དུ། གཞུང་།')).toBe(true);
    });

    it('fails clearly outside an eText download', () => {
      const { code, stderr } = cli('extract', dir, 'toh1');
      expect(code).toBe(1);
      expect(stderr).toContain('not a collection directory');
    });
  });

  describe('a volume that numbers its folios afresh', () => {
    const refs = (text: string) =>
      text
        .trim()
        .split('\n')
        .map((l) => l.slice(1, l.indexOf(']')));

    it('extracts each witness from its own run', () => {
      const ten = cli('extract', collection('kangyur/X'), 'toh10');
      expect(refs(ten.stdout)).toEqual([
        'F.1.b',
        'F.2.a',
        ...[
          '1.a',
          '1.b',
          '2.a',
          '2.b',
          '3.a',
          '3.b',
          '4.a',
          '4.b',
          '5.a',
          '5.b',
        ].map((f) => `F.${f}`),
      ]);
      expect(ten.stdout).not.toContain(NEXT_BO.trim());

      const eleven = cli('extract', collection('kangyur/X'), 'toh11');
      expect(refs(eleven.stdout)).toEqual(['F.1.b', 'F.2.a', 'F.2.b']);
      expect(eleven.stdout).not.toContain(LONG_BO.trim());
    });

    it('places a side of either run in its one witness', () => {
      const witnesses = readWitnesses(at('etexts'), 'kangyur/X');
      const named = readSides(join(collection('kangyur/X'), '002.txt')).map(
        (side) => [
          side.ref,
          witnessesAt(witnesses, 2, side.ord)
            .map((w) => w.siglum)
            .join(' '),
        ],
      );
      expect(named.slice(0, 1)).toEqual([['F.1.a', 'X10']]);
      expect(named.slice(9)).toEqual([
        ['F.5.b', 'X10'],
        ['F.1.a', ''],
        ['F.1.b', 'X11'],
        ['F.2.a', 'X11'],
        ['F.2.b', 'X11'],
      ]);
    });
  });

  describe('a volume restarting its numbering inside a text', () => {
    it('places the later run in that text only', () => {
      const witnesses = readWitnesses(at('etexts'), 'kangyur/X');
      const sides = readSides(join(collection('kangyur/X'), '003.txt'));
      const named = sides.map((side) =>
        witnessesAt(witnesses, 3, side.ord)
          .map((w) => w.siglum)
          .join(' '),
      );
      expect(named.slice(12)).toEqual(['X13', 'X13', 'X13', 'X13']);
      expect(named[1]).toBe('X12');
    });

    it("places witnesses in page order, not the catalog's folio order", () => {
      const witnesses = readWitnesses(at('etexts'), 'kangyur/Y');
      const sides = readSides(join(collection('kangyur/Y'), '001.txt'));
      const named = sides.map((side) =>
        witnessesAt(witnesses, 1, side.ord)
          .map((w) => w.siglum)
          .join(' '),
      );
      // F.6.a in the first run, F.2.a in the second.
      expect(named[10]).toBe('Y2');
      expect(named[22]).toBe('Y3');
    });
  });

  describe('quotes', () => {
    beforeAll(() => {
      cli('extract', collection('kangyur/D'), 'toh1', '--out', at('root.txt'));
    });

    it('finds a quotation across a folio break, with folios and witness', () => {
      const out = at('tengyur');
      expect(
        cli(
          'search',
          'quotes',
          collection('tengyur/D'),
          at('root.txt'),
          '--out',
          out,
        ).code,
      ).toBe(0);
      const found = jsonl(join(out, 'hits.jsonl'));
      expect(found[0]).toMatchObject({
        vol: 1,
        from: 'F.2.b',
        to: 'F.3.a',
        rootFrom: 'F.1.b',
        rootTo: 'F.1.b',
        witness: 'D9 (toh9)',
      });
      expect(found[0].matched).toBeGreaterThanOrEqual(15);
      expect(
        JSON.parse(readFileSync(join(out, 'summary.json'), 'utf8')),
      ).toMatchObject({
        collection: 'tengyur/D',
        build: 'test',
      });
    });

    it('matches a Unicode root against an EWTS collection, without the mantra', () => {
      const out = at('stok');
      cli(
        'search',
        'quotes',
        collection('kangyur/S'),
        at('root.txt'),
        '--out',
        out,
      );
      const found = jsonl(join(out, 'hits.jsonl'));
      expect(found).toHaveLength(1);
      expect(found[0].from).toBe('F.5.a');
      expect(found[0].text).toContain(PASSAGE_WY);
      expect(found[0].text).not.toContain('phaT');
    });

    it('keeps a quotation of a repeated phrase whole, on the right root folio', () => {
      const out = at('refrain');
      cli(
        'search',
        'quotes',
        collection('tengyur/D'),
        at('refrain-root.txt'),
        '--out',
        out,
      );
      const found = jsonl(join(out, 'hits.jsonl')).filter(
        (h) => h.witness === 'D8 (toh8)',
      );
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({
        from: 'F.?(after F.4.a)',
        rootFrom: 'F.1.b',
      });
      expect(found[0].matched).toBeGreaterThanOrEqual(30);
    });

    it('matches fixed-form subjoined letters against EWTS', () => {
      write(at('beryl-root.txt'), `[F.2.a] ${BERYL_BO}\n`);
      write(at('beryl.txt'), `[F.7.a] ${BERYL_WY}\n`);
      const out = at('beryl');
      cli(
        'search',
        'quotes',
        at('beryl.txt'),
        at('beryl-root.txt'),
        '--out',
        out,
      );
      const found = jsonl(join(out, 'hits.jsonl'));
      expect(found).toHaveLength(1);
      // Every syllable, the fixed-form ya included.
      expect(found[0]).toMatchObject({ syllables: 17, matched: 17 });
    });

    it('gives byte-identical output for the same inputs', () => {
      cli(
        'search',
        'quotes',
        collection('tengyur/D'),
        at('root.txt'),
        '--out',
        at('a'),
      );
      cli(
        'search',
        'quotes',
        collection('tengyur/D'),
        at('root.txt'),
        '--out',
        at('b'),
      );
      for (const f of ['hits.tsv', 'hits.jsonl', 'summary.json'])
        expect(readFileSync(at('a', f), 'utf8')).toBe(
          readFileSync(at('b', f), 'utf8'),
        );
    });

    it('requires an output directory', () => {
      const { code, stderr } = cli(
        'search',
        'quotes',
        collection('tengyur/D'),
        at('root.txt'),
      );
      expect(code).toBe(1);
      expect(stderr).toContain('--out');
    });
  });

  describe('chaining seeds', () => {
    const PHRASE = 'chos thams cad rang bzhin gyis stong pa';
    const search = (text: string) => {
      write(at('chain.txt'), `[F.1.a] ${text}\n`);
      const probe = probeFromPhrases([PHRASE]);
      return findMatches(probe, openCorpus(at('chain.txt')), {
        n: 4,
        min: () => 5,
        maxFreq: 1000,
        gap: 4,
        skipSanskrit: false,
      }).matches;
    };

    it('does not count a fragment the corpus repeats more than once', () => {
      expect(
        search('chos thams cad rang chos thams cad rang chos thams cad rang/'),
      ).toEqual([]);
    });

    it('counts a phrase syllable the corpus repeats once', () => {
      const found = search('chos thams cad rang thams cad rang bzhin/');
      expect(found).toHaveLength(1);
      expect(found[0].matched).toBe(5);
    });

    it('still finds the phrase itself', () => {
      const found = search(`dang/ ${PHRASE}/ zhes so/`);
      expect(found).toHaveLength(1);
      expect(found[0].matched).toBe(8);
    });

    it('places a run in a later phrase that it matches in full', () => {
      write(at('chain.txt'), '[F.1.a] bdag rang bzhin gyis stong ste/\n');
      const probe = probeFromPhrases([PHRASE, 'rang bzhin gyis stong']);
      const found = findMatches(probe, openCorpus(at('chain.txt')), {
        n: 4,
        min: (g) => Math.max(4, Math.ceil(0.6 * probe.groupSize[g])),
        maxFreq: 1000,
        gap: 4,
        skipSanskrit: false,
      }).matches;
      expect(found.map((m) => [m.group, m.matched])).toEqual([[1, 4]]);
    });
  });

  it('prints usage and fails on an unknown command', () => {
    expect(cli().code).toBe(2);
    expect(cli('frobnicate').code).toBe(2);
    expect(cli('search', 'frobnicate').code).toBe(2);
    const help = cli('--help');
    expect(help.code).toBe(0);
    expect(help.stdout).toMatch(/^ {2}search /m);
    expect(help.stdout).toMatch(/^ {2}extract /m);
    expect(cli('search').code).toBe(2);
    expect(cli('search', '--help').stdout).toMatch(/^ {2}quotes /m);
    const quotes = cli('search', 'quotes', '--help');
    expect(quotes.code).toBe(0);
    expect(quotes.stdout).toContain('eft search quotes <corpus>');
    expect(cli('extract', '-h').stdout).toContain('eft extract');
  });
});
