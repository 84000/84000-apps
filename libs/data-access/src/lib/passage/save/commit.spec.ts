import {
  CHUNK_ANNOTATIONS,
  CHUNK_PASSAGES,
  chunkCommit,
  commitSave,
  type SaveCommit,
} from './commit';
import type { AnnotationWriteRow, PassageWriteRow } from './types';

const passageRow = (uuid: string): PassageWriteRow => ({
  uuid,
  work_uuid: 'w',
  content: '',
  label: '',
  sort: 0,
  type: 'translation',
  xmlId: null,
  parent: null,
  toh: null,
});

const annotationRow = (uuid: string, passage: string): AnnotationWriteRow => ({
  uuid,
  passage_uuid: passage,
  type: 'paragraph',
  start: 0,
  end: 0,
  content: [],
  toh: null,
});

const commitOf = (
  passages: number,
  annotationsEach = 0,
  extra: Partial<SaveCommit> = {},
): SaveCommit => {
  const rows = Array.from({ length: passages }, (_, at) =>
    passageRow(`p${at}`),
  );
  return {
    passages: rows,
    labels: [],
    annotations: rows.flatMap((row) =>
      Array.from({ length: annotationsEach }, (_, at) =>
        annotationRow(`${row.uuid}-a${at}`, row.uuid),
      ),
    ),
    deleteAnnotations: [],
    deletePassages: [],
    ...extra,
  };
};

describe('chunkCommit', () => {
  it('commits a save within the limits in one call', () => {
    const commit = commitOf(CHUNK_PASSAGES, 2);
    expect(chunkCommit(commit)).toEqual([commit]);
  });

  it('splits a large save by passages, each with its annotations', () => {
    const chunks = chunkCommit(commitOf(CHUNK_PASSAGES * 2 + 1, 1));

    expect(chunks.map((chunk) => chunk.passages.length)).toEqual([
      CHUNK_PASSAGES,
      CHUNK_PASSAGES,
      1,
    ]);
    chunks.forEach((chunk) =>
      expect(
        chunk.annotations.every((row) =>
          chunk.passages.some((p) => p.uuid === row.passage_uuid),
        ),
      ).toBe(true),
    );
  });

  it('splits by annotations, and puts a passage with too many alone', () => {
    const commit = commitOf(3, 1);
    commit.annotations.push(
      ...Array.from({ length: CHUNK_ANNOTATIONS }, (_, at) =>
        annotationRow(`big-${at}`, 'p1'),
      ),
    );

    expect(
      chunkCommit(commit).map((chunk) => chunk.passages.map((p) => p.uuid)),
    ).toEqual([['p0'], ['p1'], ['p2']]);
  });

  it('counts the annotations of passages it does not rewrite', () => {
    const commit = commitOf(0);
    commit.annotations = ['a', 'b'].flatMap((passage) =>
      Array.from({ length: CHUNK_ANNOTATIONS }, (_, at) =>
        annotationRow(`${passage}-${at}`, passage),
      ),
    );

    expect(
      chunkCommit(commit).map((chunk) => chunk.annotations.length),
    ).toEqual([CHUNK_ANNOTATIONS, CHUNK_ANNOTATIONS]);
  });

  it('never splits a save that deletes or renumbers', () => {
    [
      { deletePassages: ['x'] },
      { deleteAnnotations: ['x'] },
      { labels: [{ uuid: 'x', label: '1' }] },
    ].forEach((extra) => {
      const commit = commitOf(CHUNK_PASSAGES + 1, 0, extra);
      expect(chunkCommit(commit)).toEqual([commit]);
    });
  });
});

describe('commitSave', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const clientFailing = (
    call: number,
    error: { message: string; code: string },
  ) => {
    let calls = 0;
    return {
      rpc: jest.fn(() =>
        Promise.resolve({ error: ++calls === call ? error : null }),
      ),
    } as never;
  };

  it('says nothing was saved when Postgres or PostgREST refused the call', async () => {
    for (const code of ['P0001', '23503', 'PGRST202']) {
      const result = await commitSave(
        clientFailing(1, { message: 'no', code }),
        commitOf(1),
      );
      expect(result).toEqual({
        error: 'Nothing was saved: no',
        savedPassages: 0,
        outcomeUnknown: false,
      });
    }
  });

  it('says the save may have been applied when the response was lost', async () => {
    const result = await commitSave(
      clientFailing(1, { message: 'fetch failed', code: '' }),
      commitOf(1),
    );
    expect(result).toMatchObject({
      error: 'The save may have been applied: fetch failed',
      outcomeUnknown: true,
    });
  });

  it('reports the chunks written before a failure', async () => {
    const result = await commitSave(
      clientFailing(2, { message: 'timeout', code: '57014' }),
      commitOf(CHUNK_PASSAGES + 1),
      { chunked: true },
    );
    expect(result).toEqual({
      error: `Partly saved: the first ${CHUNK_PASSAGES} of ${CHUNK_PASSAGES + 1} passages were saved, and the rest were not: timeout`,
      savedPassages: CHUNK_PASSAGES,
      outcomeUnknown: false,
    });
  });

  it('commits a large save in one call unless asked to chunk it', async () => {
    const client = clientFailing(0, { message: '', code: '' }) as unknown as {
      rpc: jest.Mock;
    };
    const commit = commitOf(CHUNK_PASSAGES * 2, 1);
    expect(await commitSave(client as never, commit)).toEqual({
      savedPassages: CHUNK_PASSAGES * 2,
    });
    expect(client.rpc).toHaveBeenCalledTimes(1);
  });
});
