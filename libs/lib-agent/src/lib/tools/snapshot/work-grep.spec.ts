import { compileGlob, grepSnapshot } from './work-grep';

/** A small snapshot tree for specs. */
const fixtureFiles = (): Map<string, string> =>
  new Map([
    ['README.md', '# toh8\n\nThe work as files.\n'],
    [
      'text/04-translation/001-chapter-one.md',
      [
        '## 1. Chapter One',
        '',
        'Thus did I hear at one time. The Blessed One was staying in Rājagṛha.',
        'Then the bodhisattva Mañjuśrī rose from his seat.',
        'Mañjuśrī said to the Blessed One, “Blessed One, …”',
        'The Blessed One replied to Manjushri.',
        '',
      ].join('\n'),
    ],
    [
      'text/04-translation/002-chapter-two.md',
      '## 2. Chapter Two\n\nSamantabhadra spoke.\n',
    ],
    ['tibetan/04-translation.md', 'བྱང་ཆུབ་སེམས་དཔའ་འཇམ་དཔལ།\n'],
    [
      'annotations/glossary-instances.tsv',
      'term\tpassage\nMañjuśrī\tp1\nMañjuśrī\tp2\nSamantabhadra\tp3\n',
    ],
    ['manifest.json', '{}\n'],
  ]);

const grep = (pattern: string, options: Record<string, unknown> = {}) => {
  const result = grepSnapshot(fixtureFiles(), 'toh8', { pattern, ...options });
  if (!result.ok) throw new Error(result.error);
  return result.text.split('\n');
};

describe('work-grep', () => {
  it('prints ripgrep-style matching lines, folding diacritics by default', () => {
    expect(grep('Manjusri')).toEqual([
      'annotations/glossary-instances.tsv:2:Mañjuśrī\tp1',
      'annotations/glossary-instances.tsv:3:Mañjuśrī\tp2',
      'text/04-translation/001-chapter-one.md:4:Then the bodhisattva Mañjuśrī rose from his seat.',
      'text/04-translation/001-chapter-one.md:5:Mañjuśrī said to the Blessed One, “Blessed One, …”',
      '[4 matching lines in 2 files.]',
    ]);
  });

  it('matches diacritics exactly when folding is off', () => {
    expect(grep('Manjus', { foldDiacritics: false })).toEqual([
      'text/04-translation/001-chapter-one.md:6:The Blessed One replied to Manjushri.',
      '[1 matching line in 1 file.]',
    ]);
  });

  it('ignores case on request', () => {
    expect(grep('blessed one', { mode: 'count' })).toEqual(['[No matches.]']);
    expect(
      grep('blessed one', { mode: 'count', caseInsensitive: true }),
    ).toEqual([
      'text/04-translation/001-chapter-one.md:3',
      '[3 matching lines in 1 file.]',
    ]);
  });

  it('shows context with separators between groups', () => {
    expect(grep('^## 1|replied', { context: 1, path: 'text' })).toEqual([
      'text/04-translation/001-chapter-one.md:1:## 1. Chapter One',
      'text/04-translation/001-chapter-one.md-2-',
      '--',
      'text/04-translation/001-chapter-one.md-5-Mañjuśrī said to the Blessed One, “Blessed One, …”',
      'text/04-translation/001-chapter-one.md:6:The Blessed One replied to Manjushri.',
      '[2 matching lines in 1 file.]',
    ]);
  });

  it('merges overlapping context', () => {
    const lines = grep('Mañjuśrī rose|said to', { context: 1, path: 'text' });
    expect(lines.filter((line) => line === '--')).toEqual([]);
    expect(lines).toHaveLength(5);
  });

  it('lists files and counts', () => {
    expect(grep('Samantabhadra', { mode: 'files' })).toEqual([
      'annotations/glossary-instances.tsv',
      'text/04-translation/002-chapter-two.md',
      '[2 matching lines in 2 files.]',
    ]);
  });

  it('tallies distinct matches in their original spelling', () => {
    expect(grep('Ma\\w+', { mode: 'tally' })).toEqual([
      '4\tMañjuśrī',
      '1\tManjushri',
      '[2 distinct, 5 matches; 5 matching lines in 2 files.]',
    ]);
  });

  it('tallies the first capture group when there is one', () => {
    expect(grep('Blessed (\\w+)', { mode: 'tally' })).toEqual([
      '4\tOne',
      '[1 distinct, 4 matches; 3 matching lines in 1 file.]',
    ]);
  });

  it('filters by glob and path', () => {
    expect(grep('Samantabhadra', { glob: '*.tsv', mode: 'files' })[0]).toBe(
      'annotations/glossary-instances.tsv',
    );
    expect(grep('Samantabhadra', { path: 'toh8/text', mode: 'files' })[0]).toBe(
      'text/04-translation/002-chapter-two.md',
    );
  });

  it('searches Tibetan', () => {
    expect(grep('འཇམ་དཔལ', { mode: 'files' })[0]).toBe(
      'tibetan/04-translation.md',
    );
  });

  it('stops at the head limit and says how many matched', () => {
    const lines = grep('Blessed|Mañjuśrī', { headLimit: 2 });
    expect(lines).toHaveLength(3);
    expect(lines[2]).toMatch(
      /^\[6 matching lines in 2 files; output stopped at the head_limit/,
    );
  });

  it('shows a window around the match on a long line', () => {
    const files = new Map([
      ['a.md', `${'x'.repeat(2000)} Samantabhadra ${'y'.repeat(2000)}\n`],
    ]);
    const result = grepSnapshot(files, 'toh8', { pattern: 'Samantabhadra' });
    expect(result.ok && result.text.split('\n')[0]).toMatch(
      /^a\.md:1:…x+ Samantabhadra y+…$/,
    );
  });

  it('rejects patterns RE2 cannot run, and bad paths', () => {
    expect(grepSnapshot(fixtureFiles(), 'toh8', { pattern: '(a)\\1' })).toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(
      grepSnapshot(fixtureFiles(), 'toh8', { pattern: 'a', path: '../x' }),
    ).toEqual({ ok: false, error: 'Invalid path: ../x' });
    expect(
      grepSnapshot(fixtureFiles(), 'toh8', { pattern: 'a', glob: '*.xml' }),
    ).toEqual(expect.objectContaining({ ok: false }));
  });

  it('finds anchored matches on any line', () => {
    expect(grep('^Then the', { mode: 'count' })[0]).toBe(
      'text/04-translation/001-chapter-one.md:1',
    );
    expect(grep('seat\\.$')[0]).toBe(
      'text/04-translation/001-chapter-one.md:4:Then the bodhisattva Mañjuśrī rose from his seat.',
    );
    expect(grep('\\Aterm', { mode: 'files' })[0]).toBe(
      'annotations/glossary-instances.tsv',
    );
  });

  it('tallies inside Tibetan stacks', () => {
    const files = new Map([['t.md', 'སྐྱེས་པ། སྐད།\n']]);
    const result = grepSnapshot(files, 'toh8', {
      pattern: 'སྐ',
      mode: 'tally',
    });
    expect(result.ok && result.text.split('\n')[0]).toBe('2\tསྐ');
  });

  it('cuts long tally values', () => {
    const files = new Map([['a.md', `${'x'.repeat(5000)}\n`]]);
    const result = grepSnapshot(files, 'toh8', {
      pattern: '.+',
      mode: 'tally',
    });
    if (!result.ok) throw new Error(result.error);
    expect(result.text.split('\n')[0]).toBe(`1\t${'x'.repeat(200)}…`);
    const twin = grepSnapshot(
      new Map([['a.md', `${'x'.repeat(300)}A\n${'x'.repeat(300)}B\n`]]),
      'toh8',
      { pattern: '.+', mode: 'tally' },
    );
    expect(twin.ok && twin.text).toContain('[2 distinct, 2 matches;');
  });

  it('tallies dense matches on a long folded line quickly', () => {
    const files = new Map([['a.md', `${'ā'.repeat(20_000)}\n`]]);
    const started = Date.now();
    const result = grepSnapshot(files, 'toh8', {
      pattern: 'a',
      mode: 'tally',
    });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.ok && result.text.split('\n')[0]).toBe('20000\tā');
  });

  it('matches globs in linear time', () => {
    const started = Date.now();
    const result = grepSnapshot(fixtureFiles(), 'toh8', {
      pattern: 'x',
      glob: `${'*?'.repeat(40)}Z`,
    });
    expect(Date.now() - started).toBeLessThan(1000);
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('No files'),
    });
  });

  it('runs a catastrophic-backtracking pattern in linear time', () => {
    const files = new Map([['a.md', `${'a'.repeat(50_000)}!\n`]]);
    const started = Date.now();
    const result = grepSnapshot(files, 'toh8', { pattern: '(a+)+$' });
    expect(result.ok).toBe(true);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('compileGlob', () => {
  it('matches a bare glob against the file name at any depth', () => {
    const re = compileGlob('*.md');
    expect(re.test('README.md')).toBe(true);
    expect(re.test('text/04-translation/001-a.md')).toBe(true);
    expect(re.test('annotations/layout.jsonl')).toBe(false);
  });

  it('keeps * within a segment and lets ** cross segments', () => {
    expect(compileGlob('text/*.md').test('text/04-translation/x.md')).toBe(
      false,
    );
    expect(compileGlob('text/**/*.md').test('text/04-translation/x.md')).toBe(
      true,
    );
    expect(compileGlob('text/**/*.md').test('text/x.md')).toBe(true);
  });

  it('supports choices and escapes everything else', () => {
    const re = compileGlob('*.{md,tsv}');
    expect(re.test('glossary.md')).toBe(true);
    expect(re.test('annotations/glossary-instances.tsv')).toBe(true);
    expect(re.test('notesxmd')).toBe(false);
  });
});
