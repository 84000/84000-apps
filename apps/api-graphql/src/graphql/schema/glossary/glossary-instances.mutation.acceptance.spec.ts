import { loadFilesSync } from '@graphql-tools/load-files';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { graphql, type GraphQLSchema } from 'graphql';
import { join } from 'node:path';

import { removeGlossaryTermInstances as removeInstances } from '@eightyfourthousand/client-graphql';
import type { GraphQLContext } from '../../context';
import { resolvers } from '../../resolvers';

// Acceptance tests for DEV-912 criteria 7, 8, 9 and 10 at the API: the
// removal needs editor.edit, hands the arguments to the data layer, and
// answers with what it removed, what failed and the rewritten passages. The
// data layer is mocked; the schema and resolvers are the real ones.

// The editor library is UI code the resolvers reach only for passage fields,
// and Jest cannot load its assets.
jest.mock('@eightyfourthousand/lib-editing', () => ({
  blockFromPassage: () => null,
}));
jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  removeGlossaryTermInstances: jest.fn(),
  hasPermission: jest.fn(),
}));

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
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

const MUTATION = /* GraphQL */ `
  mutation Remove($workUuid: ID!, $termUuid: ID!, $annotationUuids: [ID!]!) {
    removeGlossaryTermInstances(
      workUuid: $workUuid
      termUuid: $termUuid
      annotationUuids: $annotationUuids
    ) {
      removed
      failed {
        passageUuid
        passageLabel
        annotationUuids
        error
      }
      passages {
        uuid
      }
      error
    }
  }
`;

const variables = {
  workUuid: 'work-1',
  termUuid: 'term-1',
  annotationUuids: ['a-1', 'a-2', 'b-1'],
};

const signedIn = {
  source: 'draft',
  supabase: { marker: 'client' },
  loaders: {},
  session: { userId: 'u1', email: 'e@x.org', claims: { role: 'editor' } },
} as unknown as GraphQLContext;

const signedOut = { ...signedIn, session: null } as unknown as GraphQLContext;

const run = (contextValue: GraphQLContext) =>
  graphql({
    schema,
    source: MUTATION,
    variableValues: variables,
    contextValue,
  });

/** Refused as data or as an error from the mutation, never as a success. */
const refused = (result: Awaited<ReturnType<typeof run>>) => {
  const field = schema.getMutationType()?.getFields()[
    'removeGlossaryTermInstances'
  ];
  if (!field) return false;
  const payload = result.data?.['removeGlossaryTermInstances'] as {
    removed: string[];
    error?: string;
  } | null;
  return (
    Boolean(result.errors?.length) ||
    (payload?.removed.length === 0 && Boolean(payload?.error))
  );
};

const rewritten = (uuid: string) => ({
  uuid,
  workUuid: 'work-1',
  content: 'text',
  label: '1.1',
  sort: 1,
  type: 'translation',
  annotations: [],
});

beforeEach(() => {
  dataAccess.removeGlossaryTermInstances.mockReset();
  dataAccess.hasPermission.mockReset();
  dataAccess.hasPermission.mockResolvedValue(true);
  dataAccess.removeGlossaryTermInstances.mockResolvedValue({
    removed: ['a-1', 'a-2', 'b-1'],
    failed: [],
    passages: [],
  });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('DEV-912 removeGlossaryTermInstances mutation', () => {
  it('criterion 7: hands the work, entry and annotations to the data layer', async () => {
    const result = await run(signedIn);

    expect(result.errors).toBeUndefined();
    expect(dataAccess.removeGlossaryTermInstances).toHaveBeenCalledTimes(1);
    expect(dataAccess.removeGlossaryTermInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        client: { marker: 'client' },
        workUuid: 'work-1',
        termUuid: 'term-1',
        annotationUuids: ['a-1', 'a-2', 'b-1'],
      }),
    );
  });

  it('criterion 7: answers with the annotations removed', async () => {
    const result = await run(signedIn);

    expect(result.data?.['removeGlossaryTermInstances']).toMatchObject({
      removed: ['a-1', 'a-2', 'b-1'],
      failed: [],
    });
  });

  it('criterion 8: names the passages that failed, with their instances and the reason', async () => {
    dataAccess.removeGlossaryTermInstances.mockResolvedValue({
      removed: ['a-1', 'a-2'],
      failed: [
        {
          passageUuid: 'p-2',
          passageLabel: '1.2',
          annotationUuids: ['b-1'],
          error: 'deadlock detected',
        },
      ],
      passages: [],
    });

    const result = await run(signedIn);

    expect(result.errors).toBeUndefined();
    expect(result.data?.['removeGlossaryTermInstances']).toMatchObject({
      removed: ['a-1', 'a-2'],
      failed: [
        {
          passageUuid: 'p-2',
          passageLabel: '1.2',
          annotationUuids: ['b-1'],
          error: 'deadlock detected',
        },
      ],
    });
  });

  it('criterion 9: answers with the rewritten passages for open editors to take in', async () => {
    dataAccess.removeGlossaryTermInstances.mockResolvedValue({
      removed: ['a-1'],
      failed: [],
      passages: [rewritten('p-1'), rewritten('p-3')],
    });

    const result = await run(signedIn);

    expect(result.errors).toBeUndefined();
    expect(
      (
        result.data?.['removeGlossaryTermInstances'] as {
          passages: Array<{ uuid: string }>;
        }
      ).passages.map((p) => p.uuid),
    ).toEqual(['p-1', 'p-3']);
  });

  it('criterion 10: checks editor.edit', async () => {
    await run(signedIn);

    expect(dataAccess.hasPermission).toHaveBeenCalledWith(
      expect.objectContaining({ permission: 'editor.edit' }),
    );
  });

  it('criterion 10: a user without editor.edit removes nothing', async () => {
    dataAccess.hasPermission.mockResolvedValue(false);

    const result = await run(signedIn);

    expect(dataAccess.removeGlossaryTermInstances).not.toHaveBeenCalled();
    expect(refused(result)).toBe(true);
  });

  it('criterion 10: a signed-out caller removes nothing', async () => {
    const result = await run(signedOut);

    expect(dataAccess.removeGlossaryTermInstances).not.toHaveBeenCalled();
    expect(refused(result)).toBe(true);
  });
});

describe('DEV-912 client-graphql removeGlossaryTermInstances against the schema', () => {
  // The client's own document and variables, run against the real schema.
  const client = {
    request: (document: string, vars: Record<string, unknown>) =>
      graphql({
        schema,
        source: document,
        variableValues: vars,
        contextValue: signedIn,
      }).then((result) => {
        if (result.errors) throw result.errors[0];
        return result.data;
      }),
  };

  it('criterion 7: the client sends a removal the schema accepts and gets the result back', async () => {
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
      passages: [],
    });

    const result = await removeInstances({
      client: client as never,
      workUuid: 'work-1',
      termUuid: 'term-1',
      annotationUuids: ['a-1', 'b-1'],
    });

    expect(dataAccess.removeGlossaryTermInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        workUuid: 'work-1',
        termUuid: 'term-1',
        annotationUuids: ['a-1', 'b-1'],
      }),
    );
    expect(result).toMatchObject({
      removed: ['a-1'],
      failed: [{ passageUuid: 'p-2', passageLabel: '1.2' }],
    });
  });
});
