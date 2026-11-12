import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, type GraphQLSchema } from 'graphql';
import { join } from 'node:path';

import {
  getGlossaryTermInstances as readInstances,
  removeGlossaryTermInstances as removeInstances,
} from '@eightyfourthousand/client-graphql';
import type { GraphQLContext } from '../../context';
import { resolvers } from '../../resolvers';

// The instances read and removal through the real schema and resolvers, with
// the data layer mocked: the client's documents run as written.

// The editor library is UI code the resolvers reach only for passage fields,
// and Jest cannot load its assets.
jest.mock('@eightyfourthousand/lib-editing', () => ({
  blockFromPassage: () => null,
}));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  getGlossaryTermInstances: jest.fn(),
  removeGlossaryTermInstances: jest.fn(),
  hasPermission: jest.fn(),
}));

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getGlossaryTermInstances: jest.Mock;
  removeGlossaryTermInstances: jest.Mock;
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

const ctx = (source: 'draft' | 'published', signedIn = true): GraphQLContext =>
  ({
    source,
    supabase: { marker: 'client' },
    // A saved passage's json reads its annotations; these have none.
    loaders: {
      annotationsByPassageUuid: { load: async () => [] },
      alignmentsByPassageUuid: { load: async () => [] },
      passageReferencesByPassageUuid: { load: async () => [] },
    },
    session: signedIn
      ? { userId: 'u1', email: 'e@x.org', claims: { role: 'editor' } }
      : null,
  }) as unknown as GraphQLContext;

const ask = (source: 'draft' | 'published', variables = {}) =>
  graphql({
    schema,
    source: QUERY,
    variableValues: { uuid: 'term-1', ...variables },
    contextValue: ctx(source),
  });

/** Sends a client function's own document and variables to the schema. */
const clientFor = (contextValue: GraphQLContext) => ({
  request: (document: string, variables: Record<string, unknown>) =>
    graphql({
      schema,
      source: document,
      variableValues: variables,
      contextValue,
    }).then((result) => {
      if (result.errors) throw result.errors[0];
      return result.data;
    }),
});
const schemaClient = clientFor(ctx('draft'));

beforeEach(() => {
  dataAccess.getGlossaryTermInstances.mockReset();
  dataAccess.removeGlossaryTermInstances.mockReset();
  dataAccess.hasPermission.mockReset();
  dataAccess.hasPermission.mockResolvedValue(true);
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

describe('removeGlossaryTermInstances', () => {
  const rewritten = (uuid: string) => ({
    uuid,
    workUuid: 'work-1',
    content: 'text',
    label: '1.1',
    sort: 1,
    type: 'translation',
    annotations: [],
  });

  const remove = (signedIn = true) =>
    removeInstances({
      client: clientFor(ctx('draft', signedIn)) as never,
      workUuid: 'work-1',
      termUuid: 'term-1',
      annotationUuids: ['a-1', 'b-1'],
    });

  it('runs the client mutation against the schema', async () => {
    dataAccess.removeGlossaryTermInstances.mockResolvedValue({
      removed: ['a-1'],
      failed: [
        {
          passageUuid: 'p-2',
          passageLabel: '1.2',
          annotationUuids: ['b-1'],
          error: 'deadlock detected',
        },
      ],
      passages: [rewritten('p-1')],
    });

    const result = await remove();

    expect(dataAccess.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'editor.edit' }),
    );
    expect(dataAccess.removeGlossaryTermInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { marker: 'client' },
        workUuid: 'work-1',
        termUuid: 'term-1',
        annotationUuids: ['a-1', 'b-1'],
      }),
    );
    expect(result).toMatchObject({
      removed: ['a-1'],
      failed: [
        {
          passageUuid: 'p-2',
          passageLabel: '1.2',
          annotationUuids: ['b-1'],
          error: 'deadlock detected',
        },
      ],
    });
    expect(result.passages.map((passage) => passage.uuid)).toEqual(['p-1']);
  });

  it.each([
    ['a user without editor.edit', true],
    ['a signed-out caller', false],
  ])('removes nothing for %s', async (_name, signedIn) => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    dataAccess.hasPermission.mockResolvedValue(false);

    const result = await remove(signedIn);

    expect(dataAccess.removeGlossaryTermInstances).not.toHaveBeenCalled();
    expect(result.removed).toEqual([]);
    expect(result.error).toBeTruthy();
    jest.restoreAllMocks();
  });
});
