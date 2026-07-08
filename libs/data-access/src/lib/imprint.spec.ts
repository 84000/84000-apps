import { getTranslationImprints, imprintKey } from './imprint';
import { DataClient } from './types';

const createMockClient = (result: { data: unknown; error: unknown }) => {
  const rpc = jest.fn(() => Promise.resolve(result));
  return { client: { rpc } as unknown as DataClient, rpc };
};

const imprintRow = (uuid: string, toh: string) => ({
  work_uuid: uuid,
  toh,
  imprint: {
    work_uuid: uuid,
    toh: `Toh ${toh.replace('toh', '')}`,
    isAuthorContested: false,
    license: { name: 'CC BY-NC-ND 4.0' },
    mainTitles: { en: `Title for ${toh}` },
  },
});

describe('getTranslationImprints', () => {
  it('batches keys into a single get_imprints call', async () => {
    const { client, rpc } = createMockClient({
      data: [imprintRow('uuid-1', 'toh1'), imprintRow('uuid-2', 'toh2')],
      error: null,
    });

    const keys = [
      { uuid: 'uuid-1', toh: 'toh1' },
      { uuid: 'uuid-2', toh: 'toh2' },
    ];
    const imprints = await getTranslationImprints({ client, keys });

    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('get_imprints', {
      work_uuids: ['uuid-1', 'uuid-2'],
      tohs: ['toh1', 'toh2'],
    });
    expect(imprints.size).toBe(2);
    const first = imprints.get(imprintKey({ uuid: 'uuid-1', toh: 'toh1' }));
    expect(first?.uuid).toBe('uuid-1');
    expect(first?.mainTitles?.en).toBe('Title for toh1');
  });

  it('skips rows with no imprint', async () => {
    const { client } = createMockClient({
      data: [
        imprintRow('uuid-1', 'toh1'),
        { work_uuid: 'uuid-2', toh: 'toh2', imprint: null },
      ],
      error: null,
    });

    const imprints = await getTranslationImprints({
      client,
      keys: [
        { uuid: 'uuid-1', toh: 'toh1' },
        { uuid: 'uuid-2', toh: 'toh2' },
      ],
    });

    expect(imprints.size).toBe(1);
    expect(imprints.get(imprintKey({ uuid: 'uuid-2', toh: 'toh2' }))).toBe(
      undefined,
    );
  });

  it('returns an empty map without querying when there are no keys', async () => {
    const { client, rpc } = createMockClient({ data: [], error: null });

    const imprints = await getTranslationImprints({ client, keys: [] });

    expect(imprints.size).toBe(0);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns an empty map on error', async () => {
    const { client } = createMockClient({
      data: null,
      error: new Error('boom'),
    });
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const imprints = await getTranslationImprints({
      client,
      keys: [{ uuid: 'uuid-1', toh: 'toh1' }],
    });

    expect(imprints.size).toBe(0);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
