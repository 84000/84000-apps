import { ClientError } from 'graphql-request';

import { mayHaveBeenApplied, readBackSaved } from './save-outcome';

jest.mock('@eightyfourthousand/data-access', () => ({
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

describe('readBackSaved', () => {
  beforeEach(() => dataAccess.getPassageSorts.mockReset());

  it('reads the passages back', async () => {
    dataAccess.getPassageSorts.mockResolvedValue(new Map([['a', 1]]));

    expect(await readBackSaved(['a', 'b'])).toBe(true);
    expect(dataAccess.getPassageSorts).toHaveBeenCalledWith(
      expect.objectContaining({ uuids: ['a', 'b'] }),
    );
  });

  it('is false when the server cannot be read', async () => {
    dataAccess.getPassageSorts.mockResolvedValueOnce(null);
    expect(await readBackSaved(['a'])).toBe(false);

    dataAccess.getPassageSorts.mockRejectedValueOnce(new Error('offline'));
    expect(await readBackSaved(['a'])).toBe(false);
  });
});
