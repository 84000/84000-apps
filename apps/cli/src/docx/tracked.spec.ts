import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { run } from '../cli';
import { checkTracked, type Finding } from './tracked';
import { readZip } from './zip';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (data: Buffer) => {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/** A zip of `files`, the first stored and the rest deflated. */
function zip(files: Record<string, string>): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  Object.entries(files).forEach(([name, text], i) => {
    const raw = Buffer.from(text, 'utf8');
    const method = i === 0 ? 0 : 8;
    const body = method ? deflateRawSync(raw) : raw;
    const nameBytes = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(method, 8);
    local.writeUInt32LE(crc32(raw), 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(method, 10);
    central.writeUInt32LE(crc32(raw), 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(raw.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, body);
    centrals.push(central, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  });
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(centrals.length / 2, 8);
  end.writeUInt16LE(centrals.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const NS =
  'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"';
const ITALIC = '<w:rPr><w:i/></w:rPr>';
const BY = 'w:author="Claude" w:date="2026-11-11T00:00:00Z"';

const t = (text: string) => `<w:t xml:space="preserve">${text}</w:t>`;
const r = (text: string, props = '') => `<w:r>${props}${t(text)}</w:r>`;
const p = (...runs: string[]) => `<w:p>${runs.join('')}</w:p>`;
const ins = (text: string, id = 1, author = BY) =>
  `<w:ins w:id="${id}" ${author}>${r(text)}</w:ins>`;
const del = (text: string, id = 2, author = BY) =>
  `<w:del w:id="${id}" ${author}><w:r><w:delText xml:space="preserve">${text}</w:delText></w:r></w:del>`;
const body = (...paragraphs: string[]) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document ${NS}><w:body>${paragraphs.join('')}<w:sectPr/></w:body></w:document>`;
const notes = (...paragraphs: string[]) =>
  `<w:endnotes ${NS}><w:endnote w:type="separator" w:id="0">${p('<w:r><w:separator/></w:r>')}</w:endnote>` +
  paragraphs
    .map((x, i) => `<w:endnote w:id="${i + 2}">${x}</w:endnote>`)
    .join('') +
  `</w:endnotes>`;
const docx = (document: string, endnotes?: string) =>
  zip({
    '[Content_Types].xml': '<Types/>',
    'word/document.xml': document,
    ...(endnotes ? { 'word/endnotes.xml': endnotes } : {}),
  });

const check = (
  before: string,
  after: string,
  beforeNotes?: string,
  afterNotes?: string,
) =>
  checkTracked(
    docx(before, beforeNotes),
    docx(after, afterNotes),
    'Claude',
    true,
  );
const failures = (findings: Finding[]) =>
  findings.filter((f) => f.check !== 'change');
const problems = (findings: Finding[], check: string) =>
  findings.filter((f) => f.check === check).map((f) => f.problem);

// A verse paragraph: two lines in one run, the first with a stray trailing space.
const VERSE = p(
  '<w:r><w:t xml:space="preserve">The first line </w:t><w:br/><w:t>the second line.</w:t></w:r>',
);

describe('readZip', () => {
  it('reads stored and deflated entries', () => {
    const entries = readZip(zip({ a: 'stored', 'b/c.xml': 'deflated' }));
    expect(entries.get('a')?.toString()).toBe('stored');
    expect(entries.get('b/c.xml')?.toString()).toBe('deflated');
  });

  it('refuses a file that is not a zip', () => {
    expect(() =>
      readZip(Buffer.from('not a zip at all, just some text')),
    ).toThrow('Not a zip file.');
  });
});

describe('checkTracked', () => {
  it('passes a minimal insertion and deletion', () => {
    const { findings, revisions } = check(
      body(p(r('the path tobuddha qualities')), p(r('Well-Gone One , your'))),
      body(
        p(r('the path to'), ins(' '), r('buddha qualities')),
        p(r('Well-Gone One'), del(' '), r(', your')),
      ),
    );
    expect(failures(findings)).toEqual([]);
    expect(revisions).toEqual({ author: 2, others: 0 });
    expect(findings.map((f) => f.problem)).toEqual(['"" → " "', '" " → ""']);
  });

  it('passes a stray space deleted from a split run that keeps its line break', () => {
    const tracked = p(
      '<w:r><w:t>The first line</w:t></w:r>',
      del(' '),
      '<w:r><w:br/><w:t>the second line.</w:t></w:r>',
    );
    expect(failures(check(body(VERSE), body(tracked)).findings)).toEqual([]);
  });

  it('fails a split run rebuilt from its text, which drops the line break', () => {
    const tracked = p(r('The first line'), del(' '), r('the second line.'));
    const { findings } = check(body(VERSE), body(tracked));
    expect(problems(findings, 'reject-all')).toEqual([
      'expected a line break, found "t"; line breaks: 1 in the original, 0 here',
    ]);
    expect(problems(findings, 'accept-all')).toEqual([
      'expected a line break, found the end of the paragraph; line breaks: 1 in the original, 0 here',
    ]);
    expect(findings.find((f) => f.check === 'reject-all')).toMatchObject({
      part: 'document',
      where: 'paragraph 1',
      context: 'The first line []↵the second line.',
    });
  });

  it('ignores how the text is split into runs and rsid attributes', () => {
    const tracked = p(
      '<w:r w:rsidR="00AB12CD"><w:t xml:space="preserve">The first </w:t></w:r>',
      '<w:r><w:t xml:space="preserve">line </w:t><w:br/></w:r>',
      '<w:r><w:t>the second line.</w:t></w:r>',
    );
    expect(failures(check(body(VERSE), body(tracked)).findings)).toEqual([]);
  });

  it('fails a change tracked with its context', () => {
    const { findings } = check(
      body(p(r('scrape the scarp of the hill'))),
      body(
        p(
          r('scrape '),
          del('the scarp of'),
          ins('the scrap of', 3),
          r(' the hill'),
        ),
      ),
    );
    expect(problems(findings, 'minimal')).toEqual([
      'tracks unchanged "the sc" and "p of" and is not one whole word; track only "ar" → "ra", or the whole word',
    ]);
    expect(problems(findings, 'reject-all')).toEqual([]);
  });

  it('fails unchanged words kept inside one change', () => {
    const { findings } = check(
      body(p(r('a big red dog'))),
      body(p(del('a big red dog'), ins('the big red cat', 3))),
    );
    expect(problems(findings, 'minimal')).toEqual([
      'keeps unchanged text inside the change ("big", "red")',
    ]);
  });

  it('passes a misspelling tracked as the whole word', () => {
    const { findings } = check(
      body(p(r('a scarp of paper'))),
      body(p(r('a '), del('scarp'), ins('scrap', 3), r(' of paper'))),
    );
    expect(failures(findings)).toEqual([]);
  });

  it('fails a change of case, a diacritic or a single letter tracked as the whole word', () => {
    const { findings } = check(
      body(p(r('the Devaputra and prātimokśa and he elder'))),
      body(
        p(
          r('the '),
          del('Devaputra', 2),
          ins('devaputra', 3),
          r(' and '),
          del('prātimokśa', 4),
          ins('prātimokṣa', 5),
          r(' and '),
          del('he', 6),
          ins('the', 7),
          r(' elder'),
        ),
      ),
    );
    expect(problems(findings, 'minimal')).toEqual([
      'tracks unchanged "evaputra" with a change of case; track only "D" → "d"',
      'tracks unchanged "prātimok" and "a" with a diacritic; track only "ś" → "ṣ"',
      'tracks unchanged "he" with a single letter; track only "" → "t"',
    ]);
  });

  it('fails a stray space tracked with the word before it', () => {
    const { findings } = check(
      body(p(r('Well-Gone One , your'))),
      body(p(r('Well-Gone '), del('One '), ins('One', 3), r(', your'))),
    );
    expect(problems(findings, 'minimal')).toEqual([
      'tracks unchanged "One" with a space or punctuation mark; track only " " → ""',
    ]);
  });

  it('fails an insertion placed between two parts of one deletion', () => {
    const { findings } = check(
      body(p(r('a scarp of paper'))),
      body(
        p(
          r('a '),
          del('sca', 2),
          ins('scrap', 3),
          del('rp', 4),
          r(' of paper'),
        ),
      ),
    );
    expect(problems(findings, 'minimal')).toEqual([
      'an insertion stands between two parts of one deletion; put the whole deletion first',
    ]);
  });

  it('fails an untracked formatting change and passes a tracked one', () => {
    const before = body(p(r('a '), r('sūtra', ITALIC), r(' text')));
    const untracked = body(p(r('a '), r('sūtra'), r(' text')));
    expect(problems(check(before, untracked).findings, 'reject-all')).toEqual([
      'formatting differs at "s"',
    ]);
    const tracked = body(
      p(
        r('a '),
        `<w:r><w:rPr><w:rPrChange w:id="5" ${BY}>${ITALIC}</w:rPrChange></w:rPr>${t('sūtra')}</w:r>`,
        r(' text'),
      ),
    );
    const { findings } = check(before, tracked);
    expect(failures(findings)).toEqual([]);
    expect(findings.map((f) => f.problem)).toEqual(['formatting of "sūtra"']);
  });

  it('fails an untracked text change', () => {
    const { findings } = check(
      body(p(r('the elder said'))),
      body(p(r('the elders said'))),
    );
    expect(problems(findings, 'reject-all')).toEqual([
      'expected " ", found "s"',
    ]);
  });

  it('reports a different paragraph count at the first paragraph that differs', () => {
    const { findings } = check(
      body(p(r('one')), p(r('two')), p(r('three'))),
      body(p(r('one')), p(r('two three'))),
    );
    expect(findings.find((f) => f.check === 'reject-all')).toMatchObject({
      where: 'paragraph 2',
      problem:
        '3 paragraphs in the original, 2 here; the first that differs is this one',
    });
  });

  it('merges a paragraph whose mark the author inserted when rejecting', () => {
    const { findings } = check(
      body(p(r('one two'))),
      body(
        `<w:p><w:pPr><w:rPr><w:ins w:id="7" ${BY}/></w:rPr></w:pPr>${r('one')}</w:p>`,
        p(r('two')),
      ),
    );
    expect(problems(findings, 'reject-all')).toEqual([
      'expected " ", found "t"',
    ]);
  });

  it("leaves other authors' revisions as they are", () => {
    const editor = 'w:author="Editor" w:date="2026-10-01T00:00:00Z"';
    const before = body(p(r('a '), ins('fine', 9, editor), r(' text')));
    const after = body(
      p(r('a '), ins('fine', 12, editor), r(' text'), ins('.', 13)),
    );
    const { findings, revisions } = check(before, after);
    expect(failures(findings)).toEqual([]);
    expect(revisions).toEqual({ author: 1, others: 1 });
  });

  it('labels a change in an endnote and flags a comment anchored inside one', () => {
    const before = notes(p(r('A note tobe read.')));
    const after = notes(
      p(
        '<w:commentRangeStart w:id="0"/>',
        r('A note to'),
        ins(' '),
        r('be read.'),
        '<w:commentRangeEnd w:id="0"/><w:r><w:commentReference w:id="0"/></w:r>',
      ),
    );
    const { findings } = check(
      body(p(r('text'))),
      body(p(r('text'))),
      before,
      after,
    );
    expect(findings.map((f) => [f.check, f.part, f.where])).toEqual([
      ['change', 'endnotes', 'endnote 1'],
      ['comments', 'endnotes', 'endnote id 2'],
    ]);
  });

  it('flags a changed run whose text loses its edge space', () => {
    const { findings } = check(
      body(p(r('one  two'))),
      body(p('<w:r><w:t>one </w:t></w:r>', del(' '), r('two'))),
    );
    expect(problems(findings, 'space')).toEqual([
      '<w:t> begins or ends with a space but has no xml:space="preserve"',
    ]);
  });

  it('flags a part missing from the tracked file', () => {
    const findings = checkTracked(
      docx(body(p(r('text'))), notes(p(r('note')))),
      docx(body(p(r('text')))),
    ).findings;
    expect(findings).toEqual([
      {
        check: 'parts',
        part: 'endnotes',
        where: '',
        problem: 'missing from the tracked file',
        context: '',
      },
    ]);
  });
});

describe('eft docx check-tracked', () => {
  let dir: string;
  const cli = (...args: string[]) => {
    let stdout = '';
    let stderr = '';
    const code = run(args, {
      stdout: (s) => (stdout += s),
      stderr: (s) => (stderr += s),
      now: () => 0,
    });
    return { code, stdout, stderr };
  };

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'eft-docx-'));
    writeFileSync(join(dir, 'original.docx'), docx(body(VERSE)));
    writeFileSync(
      join(dir, 'good.docx'),
      docx(
        body(
          p(
            '<w:r><w:t>The first line</w:t></w:r>',
            del(' '),
            '<w:r><w:br/><w:t>the second line.</w:t></w:r>',
          ),
        ),
      ),
    );
    writeFileSync(
      join(dir, 'bad.docx'),
      docx(body(p(r('The first line'), del(' '), r('the second line.')))),
    );
  });
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('exits 0 with nothing on stdout when every check passes', () => {
    const out = cli(
      'docx',
      'check-tracked',
      join(dir, 'original.docx'),
      join(dir, 'good.docx'),
    );
    expect(out).toMatchObject({ code: 0, stdout: '' });
    expect(out.stderr).toContain('1 revisions by Claude, 0 by others.');
    expect(out.stderr).toContain('all checks pass');
  });

  it('exits 1 and lists the problems as JSON lines', () => {
    const out = cli(
      'docx',
      'check-tracked',
      join(dir, 'original.docx'),
      join(dir, 'bad.docx'),
      '--json',
    );
    expect(out.code).toBe(1);
    const rows = out.stdout
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(rows.map((row) => row.check)).toEqual(['reject-all', 'accept-all']);
    expect(out.stderr).toContain('reject-all 1, accept-all 1');
  });

  it('lists the changes with --changes without failing on them', () => {
    const out = cli(
      'docx',
      'check-tracked',
      join(dir, 'original.docx'),
      join(dir, 'good.docx'),
      '--changes',
    );
    expect(out.code).toBe(0);
    expect(out.stdout).toBe(
      'check\tpart\twhere\tproblem\tcontext\nchange\tdocument\tparagraph 1\t" " → ""\tThe first line[" " → ""]↵the second line.\n',
    );
  });

  it('warns when the author has no revisions', () => {
    const out = cli(
      'docx',
      'check-tracked',
      join(dir, 'original.docx'),
      join(dir, 'good.docx'),
      '--author',
      'Someone',
    );
    expect(out.stderr).toContain('No revisions by "Someone": check --author.');
  });
});
