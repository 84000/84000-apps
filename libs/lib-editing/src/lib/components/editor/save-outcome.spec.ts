import { ClientError, type GraphQLClient } from 'graphql-request';
import {
  createGraphQLClient,
  RequestNotSentError,
  resetGraphQLClient,
  setAccessTokenProvider,
} from '@eightyfourthousand/client-graphql';

import {
  canReload,
  judgeSave,
  mayHaveBeenApplied,
  readStored,
} from './save-outcome';
import type { UnconfirmedSave } from './editor-context';

// The client barrels leak `data-access/ssr`.
jest.mock('next/server', () => ({
  NextRequest: class {},
  NextResponse: class {},
}));
jest.mock('resend', () => ({ Resend: class {} }));

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  createBrowserClient: jest.fn(() => ({})),
  getPassageSorts: jest.fn(),
}));

const dataAccess = jest.requireMock('@eightyfourthousand/data-access') as {
  getPassageSorts: jest.Mock;
};

const clientError = (
  status: number,
  errors?: { message: string; path?: string[] }[],
) =>
  new ClientError(
    {
      status,
      errors,
      headers: new Headers(),
      body: '',
    } as unknown as ConstructorParameters<typeof ClientError>[0],
    { query: 'mutation SavePassages' },
  );

describe('mayHaveBeenApplied', () => {
  it('is true when no answer arrived', () => {
    expect(mayHaveBeenApplied(new TypeError('Failed to fetch'))).toBe(true);
    expect(mayHaveBeenApplied(new DOMException('aborted', 'AbortError'))).toBe(
      true,
    );
  });

  it('is true for a server error, such as a gateway timeout', () => {
    expect(mayHaveBeenApplied(clientError(504))).toBe(true);
    expect(mayHaveBeenApplied(clientError(500))).toBe(true);
  });

  // The mutation ran, so the write may have committed before resolving its
  // result failed.
  it('is true for an error raised while resolving the result', () => {
    expect(
      mayHaveBeenApplied(
        clientError(200, [
          { message: 'boom', path: ['savePassages', 'passages', '0'] },
        ]),
      ),
    ).toBe(true);
  });

  it('is false for a request the server refused before running', () => {
    expect(
      mayHaveBeenApplied(clientError(400, [{ message: 'invalid input' }])),
    ).toBe(false);
    expect(mayHaveBeenApplied(clientError(401))).toBe(false);
  });
});

describe('a request the access token stopped', () => {
  const fetch = jest.fn();
  const realFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_GRAPHQL_URL = 'http://api.test/graphql';
    globalThis.fetch = fetch;
    resetGraphQLClient();
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    resetGraphQLClient();
  });

  it('was not sent, so wrote nothing', async () => {
    setAccessTokenProvider(async () => {
      throw new Error('session expired');
    });

    const error = await createGraphQLClient()
      .request('mutation { savePassages }')
      .catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(RequestNotSentError);
    expect(mayHaveBeenApplied(error)).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('readStored', () => {
  beforeEach(() => dataAccess.getPassageSorts.mockReset());

  it('reads which passages are stored', async () => {
    dataAccess.getPassageSorts.mockResolvedValue(new Map([['a', 1]]));

    expect(await readStored(['a', 'b'])).toEqual(new Set(['a']));
    expect(dataAccess.getPassageSorts).toHaveBeenCalledWith(
      expect.objectContaining({ uuids: ['a', 'b'] }),
    );
  });

  it('is null when the server cannot be read', async () => {
    dataAccess.getPassageSorts.mockResolvedValueOnce(null);
    expect(await readStored(['a'])).toBeNull();

    dataAccess.getPassageSorts.mockRejectedValueOnce(new Error('offline'));
    expect(await readStored(['a'])).toBeNull();
  });
});

describe('judgeSave', () => {
  const save = (
    sent: string[],
    inserted: string[],
    deleted: string[],
  ): UnconfirmedSave => ({
    sent,
    inserted,
    deleted,
    newerChanges: () => 0,
    restore: async () => undefined,
  });
  const stored = (...uuids: string[]) => new Set(uuids);

  it('was applied when a new passage is stored', () => {
    expect(judgeSave(stored('a', 'n'), save(['a', 'n'], ['n'], []))).toBe(
      'applied',
    );
  });

  it('was applied when a deleted passage is gone', () => {
    expect(judgeSave(stored('a'), save(['a'], [], ['d']))).toBe('applied');
  });

  it('was not applied when a new passage is missing', () => {
    expect(judgeSave(stored('a'), save(['a', 'n'], ['n'], []))).toBe(
      'not-applied',
    );
  });

  it('was not applied when a deleted passage is still stored', () => {
    expect(judgeSave(stored('a', 'd'), save(['a'], [], ['d']))).toBe(
      'not-applied',
    );
  });

  // Content alone leaves no trace of whether it was written.
  it('cannot tell for a save that only changed content', () => {
    expect(judgeSave(stored('a'), save(['a'], [], []))).toBe('undecided');
  });
});

describe('canReload', () => {
  const request = jest.fn();
  const graphql = { request } as unknown as GraphQLClient;
  const page = (...uuids: string[]) => ({
    work: { uuid: 'w1', passages: { nodes: uuids.map((uuid) => ({ uuid })) } },
  });

  beforeEach(() => request.mockReset());

  it('is true when the stored passages come back', async () => {
    request.mockResolvedValue(page('a', 'b'));
    expect(await canReload(graphql, 'w1', ['a', 'b'])).toBe(true);
    expect(request.mock.calls[0][1]).toMatchObject({
      filter: { uuids: ['a', 'b'] },
    });
  });

  // The server answers a read it could not make with an empty page.
  it('is false when they do not', async () => {
    request.mockResolvedValue(page());
    expect(await canReload(graphql, 'w1', ['a'])).toBe(false);

    request.mockResolvedValue(page('a'));
    expect(await canReload(graphql, 'w1', ['a', 'b'])).toBe(false);
  });

  it('is false when the API cannot be reached', async () => {
    request.mockRejectedValue(clientError(502));
    expect(await canReload(graphql, 'w1', ['a'])).toBe(false);
  });

  it('needs some passage when none is known to be stored', async () => {
    request.mockResolvedValue(page('x'));
    expect(await canReload(graphql, 'w1', [])).toBe(true);

    request.mockResolvedValue(page());
    expect(await canReload(graphql, 'w1', [])).toBe(false);
  });
});
