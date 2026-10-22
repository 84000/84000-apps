import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import patterns from '../../structure-patterns.json';
import { run } from '../cli';
import { openCorpus } from './corpus';
import { compilePatterns, numeralValue, structure } from './structure';

// Closing formulas in the forms Degé texts write them.
const TEXT_BO = [
  '[F.1.a] ༄༅། །རྒྱ་གར་སྐད་དུ། ཆོས་ཐམས་ཅད་རང་བཞིན་གྱིས་སྟོང་པའོ། །',
  '[F.1.b] དེ་ནས་དཔའ་མོ་རྡོ་རྗེ་བདེ་མས་གསོལ་པ། བཅོམ་ལྡན་འདས་ཀྱིས་བཀའ་སྩལ་པ། ཆོས་ཐམས་ཅད་རང་བཞིན་གྱིས་སྟོང་པའོ། །རྒྱུད་ཀྱི་རྒྱལ་པོ་ལས། གླེང་གཞིའི་ལེའུ་སྟེ་དང་པོའོ།། །།',
  '[F.2.a] ཆོས་ཐམས་ཅད་རང་བཞིན་གྱིས་སྟོང་པའོ། །རྒྱུད་ཀྱི་རྒྱལ་པོ་ལས་ཀླུ་སྒྲུབ་པའི་ལེའུ་སྟེ་',
  '[F.2.b] བཅྭ་ལྔ་པའོ།། །།',
  '[F.3.a] ཡང་ལེའུ་སྟེ་བཅྭ་ལྔ་པའོ། །',
  '[F.3.b] གསང་བ་ཞེས་བྱ་བའི་བརྟག་པ་སྟེ་དང་པོ་རྫོགས་སོ།། །།',
  '[F.4.a] སྔགས་ཀྱི་ལེའུ་སྟེ་དང་པོའོ། །',
  '[F.4.b] ཤེས་རབ་ཀྱི་ཕ་རོལ་ཏུ་ཕྱིན་པ་ལས། མཐའ་ཡས་པའི་ལེའུ་ཞེས་བྱ་སྟེ་གཉིས་པའོ། །',
  '[F.5.a] བརྒྱ་བྱིན་གྱི་ལེའུ་གཉིས་པ་སྟེ། གསུམ་པ།། །།',
  '[F.5.b] འདི་ནི་བྱང་ཆུབ་སེམས་དཔའ་རྣམས་ཀྱི་ཚུལ་ཁྲིམས་ཀྱི་གཏེར་ཏེ་གཉིས་པའོ། །',
  '[F.6.a] ལེའུ་གཉིས་པ་ལ་བལྟའོ། །རྒྱུད་ཀྱི་རྒྱལ་པོ་ཞེས་བྱ་བ་རྫོགས་སོ།། །།',
  '[F.6.b] ཕྱི་མའི་ལེའུ་རྫོགས་སོ།། །།',
].join('\n');

const TEXT_WY = [
  "[F.1.b] dpa' mo rdo rje bde mas gsol pa/ rgyud kyi rgyal po las/ gleng gzhi'i le'u ste dang po'o// //",
  "[F.2.a] klu sgrub pa'i le'u ste gnyis pa'o// //",
].join('\n');

describe('structure', () => {
  let dir: string;
  const file = (name: string, text: string) => {
    const path = join(dir, name);
    writeFileSync(path, `${text}\n`);
    return path;
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

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'tibetan-structure-'));
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reads cardinal numbers', () => {
    const c = compilePatterns(patterns);
    const n = (s: string) => numeralValue(s.split(' '), c);
    expect(n('bcu gsum')).toBe(13);
    expect(n('bco lnga')).toBe(15);
    expect(n('nyi shu rtsa gcig')).toBe(21);
    expect(n('bzhi bcu')).toBe(40);
    expect(n('brgya dang bcu gsum')).toBe(113);
    expect(n('nyis brgya')).toBe(200);
    expect(n('gnyis gsum')).toBeNull();
    expect(n('ste')).toBeNull();
  });

  it('finds closing formulas by shape, with folios and numbering notes', () => {
    const entries = structure(
      openCorpus(file('text.txt', TEXT_BO)),
      patterns,
      new Set(['division', 'ordinal', 'end']),
    );
    expect(
      entries.map((e) => [
        e.kind,
        e.level,
        e.label,
        e.number,
        e.from,
        e.at,
        e.to,
        e.note,
      ]),
    ).toEqual([
      ['division', 1, 'le’u', 1, 'F.1.a', 'F.1.b', 'F.1.b', ''],
      ['division', 1, 'le’u', 15, 'F.2.a', 'F.2.a', 'F.2.b', 'skips 2–14'],
      ['division', 1, 'le’u', 15, 'F.3.a', 'F.3.a', 'F.3.a', 'repeats 15'],
      ['division', 0, 'brtag pa', 1, 'F.1.a', 'F.3.b', 'F.3.b', ''],
      // Its parent closed, so le’u counts afresh: no restart note.
      ['division', 1, 'le’u', 1, 'F.4.a', 'F.4.a', 'F.4.a', ''],
      ['division', 1, 'le’u', 2, 'F.4.b', 'F.4.b', 'F.4.b', ''],
      ['division', 1, 'le’u', 3, 'F.5.a', 'F.5.a', 'F.5.a', ''],
      ['ordinal', null, 'gter', 2, 'F.5.b', 'F.5.b', 'F.5.b', ''],
      ['end', null, '', null, 'F.6.a', 'F.6.a', 'F.6.a', ''],
      ['division', 1, 'le’u', null, 'F.5.b', 'F.6.b', 'F.6.b', ''],
    ]);
    // The statement runs back over a single shad (rgyal po las།) to the
    // previous double shad, and keeps the closing shad.
    expect(entries[0].text).toBe(
      'rgyud kyi rgyal po las/ gleng gzhi’i le’u ste dang po’o//',
    );
    expect(entries[0].tibetan).toBe(
      'རྒྱུད་ཀྱི་རྒྱལ་པོ་ལས། གླེང་གཞིའི་ལེའུ་སྟེ་དང་པོའོ།།',
    );
    expect(entries[1].text).toBe(
      'rgyud kyi rgyal po las klu sgrub pa’i le’u ste bcwa lnga pa’o//',
    );
    expect(entries[6].text).toBe('brgya byin gyi le’u gnyis pa ste/ gsum pa//');
  });

  it('finds speech formulas with their speaker', () => {
    const entries = structure(
      openCorpus(file('text.txt', TEXT_BO)),
      patterns,
      new Set(['speech']),
    );
    expect(entries.map((e) => [e.label, e.at, e.text])).toEqual([
      ['gsol pa', 'F.1.b', 'de nas dpa’ mo rdo rje bde mas gsol pa/'],
      ['bka’ stsal pa', 'F.1.b', 'bcom ldan ’das kyis bka’ stsal pa/'],
    ]);
  });

  it('reads EWTS text the same way', () => {
    const entries = structure(openCorpus(file('wy.txt', TEXT_WY)), patterns);
    expect(entries.map((e) => [e.kind, e.label, e.number, e.at])).toEqual([
      ['speech', 'gsol pa', null, 'F.1.b'],
      ['division', 'le’u', 1, 'F.1.b'],
      ['division', 'le’u', 2, 'F.2.a'],
    ]);
    expect(entries[1].text).toBe(
      'rgyud kyi rgyal po las/ gleng gzhi’i le’u ste dang po’o//',
    );
  });

  const rows = (text: string, kinds?: string[]) =>
    structure(
      openCorpus(file('case.txt', text)),
      patterns,
      kinds && new Set(kinds as never[]),
    );

  it('ends a statement at one shad after a final ga', () => {
    const [entry] = rows(
      '[F.1.a] བཅོམ་ལྡན་འདས་ཀྱིས་ཉོན་ཅིག །གླེང་གཞིའི་ལེའུ་སྟེ་དང་པོའོ། །',
      ['division'],
    );
    expect(entry.text).toBe('gleng gzhi’i le’u ste dang po’o/');
  });

  it('keeps EWTS syllables apart across a folio break', () => {
    const [entry] = rows(
      "[F.1.a] rgyud kyi rgyal po las/ gleng gzhi'i le'u ste\n[F.1.b] dang po'o// //",
      ['division'],
    );
    expect(entry).toMatchObject({ number: 1, from: 'F.1.a', to: 'F.1.b' });
    expect(entry.text).toBe(
      'rgyud kyi rgyal po las/ gleng gzhi’i le’u ste dang po’o//',
    );
  });

  it('follows a series when its label changes form', () => {
    const entries = rows(
      [
        "[F.1.a] brtag pa'i rgyal po ste dang po'o// //",
        "[F.1.b] brtag pa'i rgyal po ste gnyis pa'o// //",
        "[F.2.a] brtag pa ste gsum pa'o// //",
      ].join('\n'),
    );
    expect(
      entries.map((e) => [e.label, e.number, e.level, e.from, e.note]),
    ).toEqual([
      ['brtag pa’i rgyal po', 1, 0, 'F.1.a', ''],
      ['brtag pa’i rgyal po', 2, 0, 'F.1.b', ''],
      [
        'brtag pa',
        3,
        0,
        'F.2.a',
        'label form changes from brtag pa’i rgyal po',
      ],
    ]);
  });

  it('nests a label that counts afresh, and lets a child count on across its parent', () => {
    const level = (lines: string[]) =>
      rows(lines.join('\n'), ['division']).map((e) => [
        e.level,
        e.label,
        e.number,
        e.note,
      ]);
    // A parent whose first closing has no ordinal, over a child that restarts.
    expect(
      level([
        "[F.1.a] ka ba'i le'u ste dang po'o// //",
        "[F.1.b] ga ba'i brtag pa'i rgyal po rdzogs so// //",
        "[F.2.a] kha ba'i le'u ste dang po'o// //",
        "[F.2.b] ga ba'i brtag pa gnyis pa'o// //",
        "[F.3.a] kha ba'i le'u ste dang po'o// //",
        "[F.3.b] ga ba'i brtag pa gsum pa'o// //",
      ]),
    ).toEqual([
      [1, 'le’u', 1, ''],
      [0, 'brtag pa’i rgyal po', null, ''],
      [1, 'le’u', 1, ''],
      [0, 'brtag pa', 2, 'label form changes from brtag pa’i rgyal po'],
      [1, 'le’u', 1, ''],
      [0, 'brtag pa', 3, ''],
    ]);
    // le’u numbered on through the brtag pa that closes between them.
    expect(
      level([
        "[F.1.a] ka ba'i le'u ste dang po'o// //",
        "[F.1.b] kha ba'i le'u ste gnyis pa'o// //",
        "[F.2.a] ga ba'i brtag pa ste dang po'o// //",
        "[F.2.b] nga ba'i le'u ste gsum pa'o// //",
        "[F.3.a] ca ba'i le'u ste bzhi pa'o// //",
        "[F.3.b] cha ba'i brtag pa ste gnyis pa'o// //",
      ]).map((r) => r[3]),
    ).toEqual(['', '', '', '', '', '']);
  });

  it('skips speech and rdzogs so inside prose', () => {
    const entries = rows(
      "[F.1.a] de nas gsol pa dang bka' stsal pa/ las ma rdzogs so// chos rdzogs so/ yongs su rdzogs so// de nas rdzogs so// //",
    );
    expect(entries.map((e) => [e.kind, e.label, e.text])).toEqual([
      ['speech', 'bka’ stsal pa', 'de nas gsol pa dang bka’ stsal pa/'],
      ['end', '', 'de nas rdzogs so//'],
    ]);
  });

  describe('cli', () => {
    it('gives identical output on every run', () => {
      const path = file('text.txt', TEXT_BO);
      const first = cli('structure', path);
      expect(first.code).toBe(0);
      expect(first.stdout.split('\n')[0]).toBe(
        'kind\tlevel\tlabel\tnumber\tvol\tfrom\tat\tto\tnote\ttext\ttibetan',
      );
      expect(cli('structure', path).stdout).toBe(first.stdout);
      expect(first.stderr).toBe(
        '8 division closings, 1 unlabelled ordinals, 1 ends, 2 speech formulas, 2 numbering notes in 0.0 s\n',
      );
    });

    it('prints the built-in patterns, and takes edited ones', () => {
      const printed = cli('structure', '--print-patterns');
      expect(JSON.parse(printed.stdout)).toEqual(patterns);
      const edited = JSON.parse(printed.stdout);
      edited.divisions.labels.push('gter');
      const path = file('patterns.json', JSON.stringify(edited));
      const { stdout } = cli(
        'structure',
        file('text.txt', TEXT_BO),
        '--patterns',
        path,
        '--kinds',
        'division',
        '--json',
      );
      const rows = stdout
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));
      expect(rows.find((r) => r.label === 'gter')?.kind).toBe('division');
      expect(rows.every((r) => r.kind === 'division')).toBe(true);
    });

    it('refuses malformed patterns and unknown kinds', () => {
      const text = file('text.txt', TEXT_BO);
      const bad = file(
        'bad.json',
        JSON.stringify({ ...patterns, speech: 'gsol pa' }),
      );
      expect(cli('structure', text, '--patterns', bad)).toMatchObject({
        code: 1,
        stderr: 'patterns: speech must be a list of strings.\n',
      });
      expect(cli('structure', text, '--kinds', 'chapter').code).toBe(1);
    });

    it('reads a directory of volume files in order', () => {
      const work = join(dir, 'work');
      rmSync(work, { recursive: true, force: true });
      mkdirSync(work);
      writeFileSync(
        join(work, 'toh1-vol002.txt'),
        `${TEXT_WY.split('\n')[1]}\n`,
      );
      writeFileSync(
        join(work, 'toh1-vol001.txt'),
        `${TEXT_WY.split('\n')[0]}\n`,
      );
      const { stdout } = cli(
        'structure',
        work,
        '--kinds',
        'division',
        '--json',
      );
      const rows = stdout
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));
      expect(rows.map((r) => [r.vol, r.number, r.from])).toEqual([
        ['toh1-vol001.txt', 1, 'F.1.b'],
        ['toh1-vol002.txt', 2, 'F.2.a'],
      ]);
    });

    it('names the volume of a division that began in another', () => {
      const work = join(dir, 'work2');
      rmSync(work, { recursive: true, force: true });
      mkdirSync(work);
      writeFileSync(
        join(work, 'toh1-vol001.txt'),
        "[F.1.a] le'u ste dang po'o// //\n[F.1.b] le'u ste gnyis pa'o// //\n",
      );
      writeFileSync(
        join(work, 'toh1-vol002.txt'),
        '[F.1.a] brtag pa dang po rdzogs so// //\n',
      );
      const { stdout } = cli('structure', work, '--json');
      const rows = stdout
        .trim()
        .split('\n')
        .map((l) => JSON.parse(l));
      expect(rows.map((r) => [r.label, r.level, r.from])).toEqual([
        ['le’u', 1, 'F.1.a'],
        ['le’u', 1, 'F.1.b'],
        ['brtag pa', 0, 'toh1-vol001.txt:F.1.a'],
      ]);
    });
  });
});
