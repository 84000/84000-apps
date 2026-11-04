import { updateGlossaryDefinition } from './update-definition';
import { DataClient } from '../types';

type QueryResult = { data: unknown; error: { message: string } | null };
type Call = { method: string; args: unknown[] };

/**
 * The entry is read with select → eq → maybeSingle, and written with
 * update → eq → eq → eq|is → select.
 */
const createMockClient = ({
  read,
  write,
}: {
  read: QueryResult;
  write?: QueryResult;
}) => {
  const calls: Call[] = [];
  const client = {
    from: jest.fn(() => {
      let writing = false;
      const builder: Record<string, jest.Mock> = {};
      const chain = (method: string) =>
        jest.fn((...args: unknown[]) => {
          calls.push({ method, args });
          if (method === 'update') writing = true;
          if (method === 'select' && writing) {
            return Promise.resolve(write ?? { data: [], error: null });
          }
          return builder;
        });
      for (const m of ['select', 'eq', 'is', 'update']) builder[m] = chain(m);
      builder.maybeSingle = jest.fn(() => Promise.resolve(read));
      return builder;
    }),
  };
  return { client: client as unknown as DataClient, calls };
};

const entry = {
  uuid: 'g-1',
  work_uuid: 'w-1',
  definition: 'Use 84000 standard.',
  definition_rend: 'overrideWithStandard',
};

const base = {
  workUuid: 'w-1',
  glossaryUuid: 'g-1',
  definition: 'A new definition.',
  expectedDefinition: 'Use 84000 standard.',
};

describe('updateGlossaryDefinition', () => {
  it('returns the change without writing on a dry run', async () => {
    const { client, calls } = createMockClient({
      read: { data: entry, error: null },
    });

    const result = await updateGlossaryDefinition({
      client,
      ...base,
      dryRun: true,
    });

    expect(result).toEqual({
      ok: true,
      dryRun: true,
      glossaryUuid: 'g-1',
      before: {
        definition: 'Use 84000 standard.',
        definitionRend: 'overrideWithStandard',
      },
      after: {
        definition: 'A new definition.',
        definitionRend: 'incompatibleWithStandard',
      },
    });
    expect(calls.some((c) => c.method === 'update')).toBe(false);
  });

  it('writes with a compare-and-set on the old definition', async () => {
    const written = {
      ...entry,
      definition: 'A new definition.',
      definition_rend: 'incompatibleWithStandard',
    };
    const { client, calls } = createMockClient({
      read: { data: entry, error: null },
      write: { data: [written], error: null },
    });

    const result = await updateGlossaryDefinition({ client, ...base });

    expect(calls).toContainEqual({
      method: 'update',
      args: [
        {
          definition: 'A new definition.',
          definition_rend: 'incompatibleWithStandard',
        },
      ],
    });
    expect(calls).toContainEqual({
      method: 'eq',
      args: ['definition', 'Use 84000 standard.'],
    });
    expect(result).toMatchObject({
      ok: true,
      dryRun: false,
      after: {
        definition: 'A new definition.',
        definitionRend: 'incompatibleWithStandard',
      },
    });
  });

  it('compares a null definition with IS NULL', async () => {
    const { client, calls } = createMockClient({
      read: { data: { ...entry, definition: null }, error: null },
      write: { data: [entry], error: null },
    });
    await updateGlossaryDefinition({
      client,
      ...base,
      expectedDefinition: null,
    });
    expect(calls).toContainEqual({ method: 'is', args: ['definition', null] });
  });

  it('refuses an entry from another work', async () => {
    const { client } = createMockClient({
      read: { data: { ...entry, work_uuid: 'w-2' }, error: null },
    });
    const result = await updateGlossaryDefinition({ client, ...base });
    expect(result).toMatchObject({ ok: false });
  });

  it('refuses when the definition changed since it was read', async () => {
    const { client, calls } = createMockClient({
      read: {
        data: { ...entry, definition: 'Edited meanwhile.' },
        error: null,
      },
    });
    const result = await updateGlossaryDefinition({ client, ...base });
    expect(result).toMatchObject({
      ok: false,
      current: { definition: 'Edited meanwhile.' },
    });
    expect(calls.some((c) => c.method === 'update')).toBe(false);
  });

  it('reports a write that touched no row', async () => {
    const { client } = createMockClient({
      read: { data: entry, error: null },
      write: { data: [], error: null },
    });
    const result = await updateGlossaryDefinition({ client, ...base });
    expect(result).toMatchObject({ ok: false });
  });

  it('refuses an empty definition and a missing entry', async () => {
    const { client } = createMockClient({ read: { data: null, error: null } });
    expect(
      await updateGlossaryDefinition({ client, ...base, definition: '  ' }),
    ).toMatchObject({ ok: false });
    expect(await updateGlossaryDefinition({ client, ...base })).toMatchObject({
      ok: false,
      error: 'No glossary entry g-1.',
    });
  });
});
