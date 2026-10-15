import { createWorkSnapshotCache } from './cache';
import {
  TIMED_OUT_RETRY_SECONDS,
  createWorkSnapshotSource,
  toWorkSnapshotStatus,
} from './create-source';
import type {
  ReadyWorkSnapshot,
  WorkSnapshotFiles,
  WorkSnapshotSource,
  WorkSnapshotStatus,
} from './source';

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

const download = {
  url: 'https://storage.test/signed',
  expiresAt: '2026-10-13T10:15:00.000Z',
  filename: 'toh8-draft.tar.gz',
};

describe('toWorkSnapshotStatus', () => {
  it('maps a ready snapshot', () => {
    const status = toWorkSnapshotStatus({
      snapshot: {
        status: 'READY',
        snapshotId: 'w/1',
        workUuid: 'w',
        root: 'toh8',
        generatedAt: '2026-10-13T10:00:00.000Z',
        current: false,
        draftChangedSince: true,
        ageMinutes: 5,
        refreshing: true,
        archiveBytes: 10,
        manifest: { tohs: ['toh8'] },
        download,
      },
      error: null,
      aborted: false,
    });
    expect(status).toEqual({
      status: 'ready',
      snapshotId: 'w/1',
      workUuid: 'w',
      root: 'toh8',
      generatedAt: '2026-10-13T10:00:00.000Z',
      current: false,
      draftChangedSince: true,
      ageMinutes: 5,
      refreshing: true,
      archiveBytes: 10,
      manifest: { tohs: ['toh8'] },
      download,
    });
  });

  it.each([
    [
      { status: 'GENERATING', retryAfterSeconds: 10 },
      { status: 'generating', retryAfterSeconds: 10 },
    ],
    [
      { status: 'FAILED', error: 'boom', retryAfterSeconds: 60 },
      { status: 'failed', error: 'boom', retryAfterSeconds: 60 },
    ],
    [{ status: 'NOT_FOUND' }, { status: 'not-found' }],
    [
      { status: 'READY', snapshotId: null },
      { status: 'error', error: 'Unexpected snapshot response.' },
    ],
  ])('maps %o', (snapshot, expected) => {
    expect(
      toWorkSnapshotStatus({ snapshot, error: null, aborted: false }),
    ).toEqual(expected);
  });

  it('reports a timed-out request as still generating', () => {
    expect(
      toWorkSnapshotStatus({ snapshot: null, error: 'timeout', aborted: true }),
    ).toEqual({
      status: 'generating',
      retryAfterSeconds: TIMED_OUT_RETRY_SECONDS,
    });
  });

  it('passes a refusal through as an error', () => {
    expect(
      toWorkSnapshotStatus({
        snapshot: null,
        error: 'Permission denied: editor.read required',
        aborted: false,
      }),
    ).toEqual({
      status: 'error',
      error: 'Permission denied: editor.read required',
    });
  });
});

describe('createWorkSnapshotSource', () => {
  const setup = (statuses: WorkSnapshotStatus[]) => {
    const ensure = jest.fn(async () => {
      const next = statuses.shift();
      if (!next) throw new Error('unexpected ensure');
      return next;
    });
    const fetchFiles = jest.fn(async () => fixtureFiles());
    const cache = createWorkSnapshotCache({ maxBytes: 10_000_000 });
    const source = createWorkSnapshotSource({ ensure, fetchFiles, cache });
    return { ensure, fetchFiles, cache, source };
  };

  it('asks for a download URL only when told to', async () => {
    const { ensure, source } = setup([fixtureSnapshot(), fixtureSnapshot()]);
    await source.ensure('toh8');
    await source.ensure('toh8', { download: true });
    expect(ensure.mock.calls).toEqual([
      ['toh8', { download: false }],
      ['toh8', { download: true }],
    ]);
  });

  /** A ready snapshot obtained through the source, as the tools obtain one. */
  const ensured = async (source: WorkSnapshotSource) => {
    const status = await source.ensure('toh8');
    if (status.status !== 'ready') throw new Error('expected ready');
    return status;
  };

  it('signs and downloads on a miss, then serves from memory', async () => {
    const signed = fixtureSnapshot(undefined, { download });
    const { ensure, fetchFiles, source } = setup([fixtureSnapshot(), signed]);
    const snapshot = await ensured(source);
    const first = await source.files(snapshot);
    expect(ensure).toHaveBeenLastCalledWith('work-1', { download: true });
    expect(fetchFiles).toHaveBeenCalledWith(
      download,
      expect.objectContaining({ snapshotId: 'work-1/100' }),
    );
    expect(first?.files.get('README.md')).toContain('toh8');

    const second = await source.files(snapshot);
    expect(second?.files).toBe(first?.files);
    expect(ensure).toHaveBeenCalledTimes(2);
    expect(fetchFiles).toHaveBeenCalledTimes(1);
  });

  it('uses the snapshot the signed request returned when it is newer', async () => {
    const newer = fixtureSnapshot(undefined, {
      snapshotId: 'work-1/200',
      download,
    });
    const { source } = setup([fixtureSnapshot(), newer]);
    const loaded = await source.files(await ensured(source));
    expect(loaded?.snapshot.snapshotId).toBe('work-1/200');
  });

  it('retries a failed download once with a fresh URL', async () => {
    const { fetchFiles, ensure, source } = setup([
      fixtureSnapshot(undefined, { download }),
      fixtureSnapshot(undefined, { download }),
    ]);
    fetchFiles.mockRejectedValueOnce(new Error('HTTP 404'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const loaded = await source.files(await ensured(source));
    expect(loaded?.files.size).toBeGreaterThan(0);
    expect(fetchFiles).toHaveBeenCalledTimes(2);
    expect(ensure).toHaveBeenCalledTimes(2);
  });

  it('gives up after the retry', async () => {
    const { fetchFiles, source } = setup([
      fixtureSnapshot(undefined, { download }),
      fixtureSnapshot(undefined, { download }),
    ]);
    fetchFiles.mockRejectedValue(new Error('HTTP 404'));
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await source.files(await ensured(source))).toBeNull();
    expect(fetchFiles).toHaveBeenCalledTimes(2);
  });

  it('returns null when the work is no longer ready to sign', async () => {
    const { fetchFiles, source } = setup([
      fixtureSnapshot(),
      { status: 'error', error: 'Permission denied' },
    ]);
    expect(await source.files(await ensured(source))).toBeNull();
    expect(fetchFiles).not.toHaveBeenCalled();
  });

  it('refuses a snapshot it did not ensure, even when cached', async () => {
    const { cache, ensure, fetchFiles, source } = setup([]);
    await cache.load('work-1/100', async () => fixtureFiles());
    expect(await source.files(fixtureSnapshot())).toBeNull();
    expect(ensure).not.toHaveBeenCalled();
    expect(fetchFiles).not.toHaveBeenCalled();
  });
});
