import type { CallToolResult } from '@modelcontextprotocol/sdk/types';
import { SNAPSHOT_TOOL_NAMES, createSnapshotTools } from './index';
import type {
  ReadyWorkSnapshot,
  WorkSnapshotFiles,
  WorkSnapshotSource,
  WorkSnapshotStatus,
} from './source';
import { OUTPUT_TOKEN_BUDGET, estimateTokens } from './text';
import { readLines } from './work-read';
import { listSnapshotDirectory } from './work-ls';

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

/** A ready snapshot whose manifest lists `files` (all but manifest.json). */
const fixtureSnapshot = (
  files: WorkSnapshotFiles = fixtureFiles(),
  overrides: Partial<ReadyWorkSnapshot> = {},
): ReadyWorkSnapshot => ({
  status: 'ready',
  snapshotId: 'work-1/100',
  workUuid: 'work-1',
  root: 'toh8',
  generatedAt: '2026-10-13T10:00:00.000Z',
  current: true,
  draftChangedSince: false,
  ageMinutes: 3,
  refreshing: false,
  archiveBytes: 1234,
  manifest: {
    tohs: ['toh8'],
    totals: { files: files.size, bytes: 999, lines: 99 },
    files: [...files.entries()]
      .filter(([path]) => path !== 'manifest.json')
      .map(([path, text]) => ({
        path,
        bytes: Buffer.byteLength(text),
        lines: text.split('\n').length - 1,
      })),
  },
  download: null,
  ...overrides,
});

const HEADER =
  '[toh8 draft snapshot · generated 2026-10-13 10:00 UTC (3 min ago) · current]';

const stubSource = (
  status: WorkSnapshotStatus = fixtureSnapshot(),
  files: WorkSnapshotFiles | null = fixtureFiles(),
) => {
  const source = {
    ensure: jest.fn(async () => status),
    files: jest.fn(async (snapshot: ReadyWorkSnapshot) =>
      files ? { snapshot, files } : null,
    ),
  } satisfies WorkSnapshotSource;
  return source;
};

const call = async (
  source: WorkSnapshotSource,
  name: (typeof SNAPSHOT_TOOL_NAMES)[number],
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> => {
  const tool = createSnapshotTools(source).find((t) => t.name === name);
  if (!tool) throw new Error(`no tool ${name}`);
  const result = (await tool.handler(
    args as never,
    {} as never,
  )) as CallToolResult;
  const first = result.content[0];
  return {
    text: first.type === 'text' ? first.text : '',
    isError: result.isError === true,
  };
};

describe('createSnapshotTools', () => {
  it('registers the four tools, all read-only', () => {
    const tools = createSnapshotTools(stubSource());
    expect(tools.map((t) => t.name)).toEqual([...SNAPSHOT_TOOL_NAMES]);
    expect(tools.every((t) => t.annotations?.readOnlyHint === true)).toBe(true);
  });

  it.each(SNAPSHOT_TOOL_NAMES)(
    '%s asks the source, which authorizes, before anything else',
    async (name) => {
      const source = stubSource({
        status: 'error',
        error: 'Permission denied: editor.read required',
      });
      const result = await call(source, name, {
        work: 'Toh 8',
        path: 'README.md',
        pattern: 'x',
      });
      expect(source.ensure).toHaveBeenCalledWith(
        'toh8',
        name === 'download-work-snapshot' ? { download: true } : undefined,
      );
      expect(source.files).not.toHaveBeenCalled();
      expect(result).toEqual({
        text: 'Permission denied: editor.read required',
        isError: true,
      });
    },
  );

  it('asks the caller to retry while a snapshot is generating', async () => {
    const result = await call(
      stubSource({ status: 'generating', retryAfterSeconds: 15 }),
      'work-read',
      { work: 'toh8', path: 'README.md' },
    );
    expect(result.isError).toBe(false);
    expect(result.text).toContain('Call again in about 15 s');
  });

  it('reports a failed generation and a missing work as errors', async () => {
    const failed = await call(
      stubSource({ status: 'failed', error: 'boom', retryAfterSeconds: 60 }),
      'work-ls',
      { work: 'toh8' },
    );
    expect(failed.isError).toBe(true);
    expect(failed.text).toContain('boom');
    const missing = await call(stubSource({ status: 'not-found' }), 'work-ls', {
      work: 'toh99999',
    });
    expect(missing.isError).toBe(true);
    expect(missing.text).toContain('resolve-toh');
  });

  it('reports files that cannot be loaded', async () => {
    const result = await call(
      stubSource(fixtureSnapshot(), null),
      'work-read',
      {
        work: 'toh8',
        path: 'README.md',
      },
    );
    expect(result.isError).toBe(true);
  });

  it('work-grep prefixes the freshness line', async () => {
    const { text } = await call(stubSource(), 'work-grep', {
      work: 'toh8',
      pattern: 'Samantabhadra',
      output_mode: 'count',
    });
    expect(text.split('\n')[0]).toBe(HEADER);
  });
});

describe('work-ls', () => {
  it('lists one level from the manifest, directories first', async () => {
    const source = stubSource();
    const { text } = await call(source, 'work-ls', { work: 'toh8' });
    const lines = text.split('\n');
    expect(lines[0]).toBe(HEADER);
    expect(lines[1]).toBe('toh8/');
    expect(lines.slice(2).map((line) => line.split(/\s+/)[0])).toEqual([
      'annotations/',
      'text/',
      'tibetan/',
      'manifest.json',
      'README.md',
    ]);
    expect(text).toMatch(/text\/\s+2 files\s+[\d,]+ bytes\s+9 lines/);
    expect(source.files).not.toHaveBeenCalled();
  });

  it('lists a subdirectory, with or without the root prefix', async () => {
    const a = await call(stubSource(), 'work-ls', {
      work: 'toh8',
      path: 'text/04-translation',
    });
    const b = await call(stubSource(), 'work-ls', {
      work: 'toh8',
      path: '/toh8/text/04-translation/',
    });
    expect(a.text).toBe(b.text);
    expect(a.text).toContain('001-chapter-one.md');
    expect(a.text).toContain('6 lines');
  });

  it('points a file path at work-read, and rejects a missing one', async () => {
    const file = await call(stubSource(), 'work-ls', {
      work: 'toh8',
      path: 'README.md',
    });
    expect(file).toEqual({
      text: '"README.md" is a file; read it with `work-read`.',
      isError: true,
    });
    const missing = await call(stubSource(), 'work-ls', {
      work: 'toh8',
      path: 'nope',
    });
    expect(missing.isError).toBe(true);
  });

  it('counts nested files into the directory totals', () => {
    const rows = listSnapshotDirectory(fixtureSnapshot(), '');
    expect(rows?.find((row) => row.name === 'text')?.files).toBe(2);
  });
});

describe('work-read', () => {
  it('numbers lines and notes where to continue', async () => {
    const { text } = await call(stubSource(), 'work-read', {
      work: 'toh8',
      path: 'text/04-translation/001-chapter-one.md',
      offset: 3,
      limit: 2,
    });
    expect(text.split('\n')).toEqual([
      HEADER,
      'toh8/text/04-translation/001-chapter-one.md',
      '3\tThus did I hear at one time. The Blessed One was staying in Rājagṛha.',
      '4\tThen the bodhisattva Mañjuśrī rose from his seat.',
      '[Lines 3–4 of 6. Continue at offset 5.]',
    ]);
  });

  it('reads to the end without a note', async () => {
    const { text } = await call(stubSource(), 'work-read', {
      work: 'toh8',
      path: 'README.md',
    });
    expect(text.split('\n').slice(2)).toEqual([
      '1\t# toh8',
      '2\t',
      '3\tThe work as files.',
    ]);
  });

  it('cuts long lines', () => {
    const text = `${'a'.repeat(2500)}\n`;
    const out = readLines({ text, starts: [0], offset: 1, limit: 10 });
    expect(out).toBe(`1\t${'a'.repeat(2000)} … [500 more chars]`);
  });

  it('stops near the token budget with the offset to continue from', () => {
    const line = 'x'.repeat(1990);
    const text = Array.from({ length: 2000 }, () => line).join('\n');
    const starts = Array.from({ length: 2000 }, (_, i) => i * 1991);
    const out = readLines({ text, starts, offset: 1, limit: 2000 });
    const lines = out.split('\n');
    expect(estimateTokens(out)).toBeLessThanOrEqual(OUTPUT_TOKEN_BUDGET + 100);
    expect(lines[lines.length - 1]).toMatch(
      /^\[Lines 1–\d+ of 2,000\. Continue at offset \d+\.\]$/,
    );
  });

  it('rejects a directory, a missing file and an offset past the end', async () => {
    const source = stubSource();
    const dir = await call(source, 'work-read', { work: 'toh8', path: 'text' });
    expect(dir.text).toContain('is a directory');
    const root = await call(source, 'work-read', { work: 'toh8', path: '/' });
    expect(root.text).toContain('snapshot root');
    const missing = await call(source, 'work-read', {
      work: 'toh8',
      path: 'nope.md',
    });
    expect(missing.isError).toBe(true);
    const past = await call(source, 'work-read', {
      work: 'toh8',
      path: 'README.md',
      offset: 9,
    });
    expect(past.text).toContain('past the end');
  });
});

describe('download-work-snapshot', () => {
  it('returns the signed URL with the archive facts', async () => {
    const download = {
      url: 'https://storage.test/signed?token=t',
      expiresAt: '2026-10-13T10:15:00.000Z',
      filename: 'toh8-draft.tar.gz',
    };
    const { text, isError } = await call(
      stubSource(fixtureSnapshot(undefined, { download })),
      'download-work-snapshot',
      { work: 'toh8' },
    );
    expect(isError).toBe(false);
    expect(text).toContain('url: https://storage.test/signed?token=t');
    expect(text).toContain('filename: toh8-draft.tar.gz');
    expect(text).toContain('archive: 1,234 bytes');
  });

  it('fails cleanly when no URL came back', async () => {
    const { isError } = await call(stubSource(), 'download-work-snapshot', {
      work: 'toh8',
    });
    expect(isError).toBe(true);
  });
});
