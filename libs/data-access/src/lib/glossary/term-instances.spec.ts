import {
  cutGlossaryInstanceContext,
  getGlossaryTermInstances,
} from './term-instances';
import type { DataClient } from '../types';

describe('cutGlossaryInstanceContext', () => {
  const content =
    'one two three four five six seven TERM eight nine ten eleven twelve thirteen';
  const start = content.indexOf('TERM');

  it('shows five words either side of the instance', () => {
    expect(cutGlossaryInstanceContext(content, start, start + 4)).toEqual({
      before: 'three four five six seven ',
      text: 'TERM',
      after: ' eight nine ten eleven twelve',
      truncatedStart: true,
      truncatedEnd: true,
      outOfRange: false,
    });
  });

  it('shows a short passage whole', () => {
    const short = 'the TERM here';
    expect(cutGlossaryInstanceContext(short, 4, 8)).toMatchObject({
      before: 'the ',
      text: 'TERM',
      after: ' here',
      truncatedStart: false,
      truncatedEnd: false,
    });
  });

  it('keeps letters joined to the instance without counting them', () => {
    const joined = 'a b c d e f bodhisattva’s g h';
    const at = joined.indexOf('bodhisattva');
    expect(cutGlossaryInstanceContext(joined, at, at + 11)).toMatchObject({
      before: 'b c d e f ',
      text: 'bodhisattva',
      after: '’s g h',
      truncatedStart: true,
    });
  });

  it('flags offsets outside the passage text', () => {
    expect(cutGlossaryInstanceContext('short', 3, 10)).toMatchObject({
      text: '',
      outOfRange: true,
    });
    expect(cutGlossaryInstanceContext(null, 0, 1).outOfRange).toBe(true);
    expect(cutGlossaryInstanceContext('short', 4, 2).outOfRange).toBe(true);
  });
});

describe('getGlossaryTermInstances', () => {
  type Call = [string, ...unknown[]];

  const instanceRow = (n: number) => ({
    uuid: `a${n}`,
    start: 4,
    end: 8,
    passage_uuid: `p${n}`,
    passages: { label: `1.${n}`, sort: n, type: 'translation' },
  });

  const clientReturning = (
    instances: { data: unknown; error: unknown; count?: number | null },
    passages: { data: unknown; error: unknown } = {
      data: [
        { uuid: 'p1', content: 'The TERM here.' },
        { uuid: 'p2', content: 'xx' },
      ],
      error: null,
    },
  ) => {
    const calls: Call[] = [];
    const builder = (result: unknown) => {
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'contains', 'or', 'order', 'in']) {
        chain[method] = (...args: unknown[]) => {
          calls.push([method, ...args]);
          return chain;
        };
      }
      chain['range'] = (...args: unknown[]) => {
        calls.push(['range', ...args]);
        return Promise.resolve(result);
      };
      chain['then'] = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result).then(resolve);
      return chain;
    };
    const client = {
      from: (table: string) =>
        builder(table === 'passages' ? passages : instances),
    } as unknown as DataClient;
    return { client, calls };
  };

  it('reads one page in passage order, then by offset', async () => {
    const { client, calls } = clientReturning({
      data: [instanceRow(1), instanceRow(2)],
      error: null,
      count: 120,
    });

    const page = await getGlossaryTermInstances({
      client,
      uuid: 'term',
      toh: 'toh8',
      offset: 50,
    });

    expect(calls).toContainEqual(['range', 50, 99]);
    expect(
      calls
        .filter(([method]) => method === 'order')
        .map(([, column]) => column),
    ).toEqual(['passages(sort)', 'passage_uuid', 'start', 'end', 'uuid']);
    expect(calls).toContainEqual([
      'contains',
      'content',
      JSON.stringify([{ uuid: 'term' }]),
    ]);
    // The Toh scope applies to the instance and to its passage.
    const scopes = calls.filter(([method]) => method === 'or');
    expect(scopes).toHaveLength(2);
    expect(scopes[1][2]).toEqual({ referencedTable: 'passages' });
    expect(scopes[0][1]).toContain('toh.like."*,toh8,*"');

    expect(page?.totalCount).toBe(120);
    expect(page?.offset).toBe(50);
    expect(page?.items[0]).toMatchObject({
      uuid: 'a1',
      passageUuid: 'p1',
      passageLabel: '1.1',
      start: 4,
      end: 8,
      before: 'The ',
      text: 'TERM',
      after: ' here.',
      outOfRange: false,
    });
    // Offsets past the end of the text: listed, flagged.
    expect(page?.items[1]).toMatchObject({ uuid: 'a2', outOfRange: true });
  });

  it('lists every Toh without one', async () => {
    const { client, calls } = clientReturning({
      data: [],
      error: null,
      count: 0,
    });

    const page = await getGlossaryTermInstances({ client, uuid: 'term' });

    expect(calls.some(([method]) => method === 'or')).toBe(false);
    expect(page).toEqual({ items: [], totalCount: 0, offset: 0 });
  });

  it('refuses a Toh it would have to write into the filter raw', async () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    const { client } = clientReturning({ data: [], error: null, count: 0 });

    expect(
      await getGlossaryTermInstances({ client, uuid: 'term', toh: 'toh8,x' }),
    ).toBeNull();
    spy.mockRestore();
  });

  it('returns null when a read fails', async () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const failed = clientReturning({ data: null, error: { message: 'x' } });
    expect(
      await getGlossaryTermInstances({ client: failed.client, uuid: 'term' }),
    ).toBeNull();

    const noText = clientReturning(
      { data: [instanceRow(1)], error: null, count: 1 },
      { data: null, error: { message: 'x' } },
    );
    expect(
      await getGlossaryTermInstances({ client: noText.client, uuid: 'term' }),
    ).toBeNull();
    spy.mockRestore();
  });

  it('caps the page size', async () => {
    const { client, calls } = clientReturning({
      data: [],
      error: null,
      count: 0,
    });

    await getGlossaryTermInstances({ client, uuid: 'term', first: 1000 });

    expect(calls).toContainEqual(['range', 0, 99]);
  });
});
