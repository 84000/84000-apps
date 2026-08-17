import { getVersionLabelsByUuids } from './publications';
import { isPublishedStatus } from './types/work';
import { DataClient } from './types';

const createMockClient = (result: { data: unknown; error: unknown }) => {
  const inFn = jest.fn(() => Promise.resolve(result));
  const select = jest.fn(() => ({ in: inFn }));
  const from = jest.fn(() => ({ select }));
  return { client: { from } as unknown as DataClient, from, select, in: inFn };
};

describe('getVersionLabelsByUuids', () => {
  it('reads work_versions in one query and keys labels by version uuid', async () => {
    const mock = createMockClient({
      data: [
        { uuid: 'v1', version: '1.2.3' },
        { uuid: 'v2', version: '0.1.18' },
      ],
      error: null,
    });

    const labels = await getVersionLabelsByUuids({
      client: mock.client,
      versionUuids: ['v1', 'v2'],
    });

    expect(mock.from).toHaveBeenCalledTimes(1);
    expect(mock.from).toHaveBeenCalledWith('work_versions');
    expect(mock.in).toHaveBeenCalledWith('uuid', ['v1', 'v2']);
    expect(labels.get('v1')).toBe('1.2.3');
    // A published work below 1.0.0 is still published. The version number is a label,
    // not a publication status, which is the assumption the old major-version heuristic made.
    expect(labels.get('v2')).toBe('0.1.18');
  });

  it('makes no query for an empty batch', async () => {
    const mock = createMockClient({ data: [], error: null });

    const labels = await getVersionLabelsByUuids({
      client: mock.client,
      versionUuids: [],
    });

    expect(mock.from).not.toHaveBeenCalled();
    expect(labels.size).toBe(0);
  });

  // A pointer naming a row that is not there should read as "unknown", not crash the query
  // that asked for it — the caller renders an absent label rather than failing the work.
  it('omits a uuid the query did not return', async () => {
    const mock = createMockClient({
      data: [{ uuid: 'v1', version: '1.0.0' }],
      error: null,
    });

    const labels = await getVersionLabelsByUuids({
      client: mock.client,
      versionUuids: ['v1', 'missing'],
    });

    expect(labels.get('v1')).toBe('1.0.0');
    expect(labels.has('missing')).toBe(false);
  });

  it('returns an empty map on error rather than throwing', async () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const mock = createMockClient({ data: null, error: { message: 'boom' } });

    const labels = await getVersionLabelsByUuids({
      client: mock.client,
      versionUuids: ['v1'],
    });

    expect(labels.size).toBe(0);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('isPublishedStatus', () => {
  // Measured against production: 456 works carry a major of 1 and all have a publication
  // date; none of the other 3,833 does.
  it.each([
    ['1', true],
    ['1.a', true],
    ['0', false],
    ['2', false],
    ['2.h', false],
    ['3', false],
    ['4', false],
  ])('reads %s as published=%s', (status, expected) => {
    expect(isPublishedStatus(status)).toBe(expected);
  });

  // Unknown is not published. The old version heuristic did the opposite — it treated an
  // absent value as published so as not to gate — which is how two unpublished works read
  // as published.
  it('treats an absent status as not published', () => {
    expect(isPublishedStatus(undefined)).toBe(false);
    expect(isPublishedStatus(null)).toBe(false);
    expect(isPublishedStatus('')).toBe(false);
  });

  // A published work below 1.0.0 exists (0.1.18) and a public work can have a legacy label
  // of 1.0 with no snapshot at all, so neither the version nor the pointer decides this.
  it('does not depend on the version number', () => {
    expect(isPublishedStatus('1.a')).toBe(true);
    expect(isPublishedStatus('0.9')).toBe(false);
  });
});
