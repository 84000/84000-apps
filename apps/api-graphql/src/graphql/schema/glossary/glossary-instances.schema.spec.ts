import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, type GraphQLSchema } from 'graphql';
import { join } from 'node:path';

import { getGlossaryTermInstances as readInstances } from '@eightyfourthousand/client-graphql';
import type { GraphQLContext } from '../../context';
import { resolvers } from '../../resolvers';

// The instances read through the real schema and resolvers, with the data
// layer mocked: the editor's alone, and the client's document runs as written.

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

/** Sends a client function's own document and variables to the schema. */
const schemaClient = {
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

beforeEach(() => {
  dataAccess.getGlossaryTermInstances.mockReset();
  dataAccess.hasPermission.mockReset();
  dataAccess.getGlossaryTermInstances.mockResolvedValue({
    items: [row(1), row(2)],
    totalCount: 18697,
    offset: 50,
  });
});

describe('glossaryTermInstances', () => {
  it('answers the editor, whose content source is draft', async () => {
    const result = await ask('draft', { toh: 'toh8', first: 50, offset: 50 });

    expect(result.errors).toBeUndefined();
    expect(result.data?.['glossaryTermInstances']).toEqual({
      items: [row(1), row(2)],
      totalCount: 18697,
      offset: 50,
    });
  });

  it('answers null to the reader, whose content source is published, reading nothing', async () => {
    const result = await ask('published', { toh: 'toh8' });

    expect(result.errors).toBeUndefined();
    expect(result.data?.['glossaryTermInstances']).toBeNull();
    expect(dataAccess.getGlossaryTermInstances).not.toHaveBeenCalled();
  });

  it('runs the client query against the schema', async () => {
    const page = await readInstances({
      client: schemaClient as never,
      uuid: 'term-1',
      toh: 'toh8',
      first: 50,
      offset: 100,
    });

    expect(dataAccess.getGlossaryTermInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { marker: 'client' },
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
