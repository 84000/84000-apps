import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, type GraphQLSchema } from 'graphql';
import { join } from 'node:path';

import { getGlossaryTermInstances as readInstances } from '@eightyfourthousand/client-graphql';
import type { GraphQLContext } from '../../context';
import { resolvers } from '../../resolvers';

// Acceptance tests for DEV-912 criteria 1, 3 and 4 at the API: the instances
// read is the editor's (draft content) alone, takes the Toh and an offset, and
// answers with the page the data layer read. The data layer is mocked; the
// schema and resolvers are the real ones.

// The editor library is UI code the resolvers reach only for passage fields,
// and Jest cannot load its assets.
jest.mock('@eightyfourthousand/lib-editing', () => ({}));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getGlossaryTermInstances: jest.fn(),
  hasPermission: jest.fn(),
}));

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getGlossaryTermInstances: jest.Mock;
  hasPermission: jest.Mock;
};

const schema: GraphQLSchema = makeExecutableSchema({
  typeDefs: mergeTypeDefs(
    loadFilesSync(join(__dirname, '..'), {
      extensions: ['graphql'],
      recursive: true,
    }),
  ),
  resolvers,
});

const QUERY = /* GraphQL */ `
  query Instances($uuid: ID!, $toh: String, $first: Int, $offset: Int) {
    glossaryTermInstances(
      uuid: $uuid
      toh: $toh
      first: $first
      offset: $offset
    ) {
      items {
        uuid
        passageUuid
        passageLabel
        passageType
        passageSort
        start
        end
        before
        text
        after
        truncatedStart
        truncatedEnd
        outOfRange
      }
      totalCount
      offset
    }
  }
`;

const row = (i: number) => ({
  uuid: `a-${i}`,
  passageUuid: `p-${i}`,
  passageLabel: `1.${i}`,
  passageType: 'translation',
  passageSort: i,
  start: 10 * i,
  end: 10 * i + 5,
  before: 'some words before',
  text: 'the term',
  after: 'some words after',
  truncatedStart: true,
  truncatedEnd: false,
  outOfRange: false,
});

const ctx = (source: 'draft' | 'published'): GraphQLContext =>
  ({
    source,
    supabase: { marker: 'client' },
    loaders: {},
    session: { userId: 'u1', email: 'e@x.org', claims: { role: 'editor' } },
  }) as unknown as GraphQLContext;

const ask = (source: 'draft' | 'published', variables = {}) =>
  graphql({
    schema,
    source: QUERY,
    variableValues: { uuid: 'term-1', ...variables },
    contextValue: ctx(source),
  });

beforeEach(() => {
  dataAccess.getGlossaryTermInstances.mockReset();
  dataAccess.hasPermission.mockReset();
  dataAccess.getGlossaryTermInstances.mockResolvedValue({
    items: [row(1), row(2)],
    totalCount: 18697,
    offset: 50,
  });
});

describe('DEV-912 glossaryTermInstances query', () => {
  it('criterion 1: answers the editor, whose content source is draft', async () => {
    const result = await ask('draft', { toh: 'toh8', first: 50, offset: 50 });

    expect(result.errors).toBeUndefined();
    expect(result.data?.['glossaryTermInstances']).toEqual({
      items: [row(1), row(2)],
      totalCount: 18697,
      offset: 50,
    });
  });

  it('criterion 1: answers null to the reader, whose content source is published, and reads nothing', async () => {
    const result = await ask('published', { toh: 'toh8' });

    expect(result.errors).toBeUndefined();
    expect(result.data?.['glossaryTermInstances']).toBeNull();
    expect(dataAccess.getGlossaryTermInstances).not.toHaveBeenCalled();
  });

  it('criterion 4: reads the entry in the Toh named', async () => {
    await ask('draft', { toh: 'toh8' });

    expect(dataAccess.getGlossaryTermInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { marker: 'client' },
        uuid: 'term-1',
        toh: 'toh8',
      }),
    );
  });

  it('criterion 3: reads the page asked for, by offset', async () => {
    await ask('draft', { toh: 'toh8', first: 50, offset: 18650 });

    expect(dataAccess.getGlossaryTermInstances).toHaveBeenCalledWith(
      expect.objectContaining({ first: 50, offset: 18650 }),
    );
  });

  it('criterion 3: answers with the total count of the whole term', async () => {
    const result = await ask('draft', { offset: 50 });

    expect(
      (result.data?.['glossaryTermInstances'] as { totalCount: number })
        .totalCount,
    ).toBe(18697);
  });

  it('criterion 3: a failed read is null, not an error that loses the dialog', async () => {
    dataAccess.getGlossaryTermInstances.mockResolvedValue(null);

    const result = await ask('draft');

    expect(result.data?.['glossaryTermInstances']).toBeNull();
  });
});

describe('DEV-912 client-graphql getGlossaryTermInstances against the schema', () => {
  // The client's own document and variables, run against the real schema.
  const client = {
    request: (document: string, variables: Record<string, unknown>) =>
      graphql({
        schema,
        source: document,
        variableValues: variables,
        contextValue: ctx('draft'),
      }).then((result) => {
        if (result.errors) throw result.errors[0];
        return result.data;
      }),
  };

  it('criterion 3: the client asks a page of the schema and gets it back', async () => {
    const page = await readInstances({
      client: client as never,
      uuid: 'term-1',
      toh: 'toh8',
      first: 50,
      offset: 100,
    });

    expect(dataAccess.getGlossaryTermInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        uuid: 'term-1',
        toh: 'toh8',
        first: 50,
        offset: 100,
      }),
    );
    expect(page).toMatchObject({
      totalCount: 18697,
      offset: 50,
      items: [row(1), row(2)],
    });
  });
});
