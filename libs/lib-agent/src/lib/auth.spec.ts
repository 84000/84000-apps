/**
 * @jest-environment node
 */
import type { DataClient } from '@eightyfourthousand/data-access';

jest.mock('jwt-decode', () => ({
  jwtDecode: jest.fn(),
}));

jest.mock('@eightyfourthousand/data-access', () => ({
  createTokenClient: jest.fn(),
  hasPermission: jest.fn(),
}));

import { jwtDecode } from 'jwt-decode';
import {
  createTokenClient,
  hasPermission,
} from '@eightyfourthousand/data-access';
import {
  validateBearerToken,
  requirePermission,
  decodeRole,
  ROLE_HIERARCHY,
} from './auth';

const mockedJwtDecode = jest.mocked(jwtDecode);
const mockedCreateTokenClient = jest.mocked(createTokenClient);
const mockedHasPermission = jest.mocked(hasPermission);

const makeRequest = (authHeader?: string) =>
  new Request('http://localhost/api/mcp', {
    method: 'POST',
    headers: authHeader ? { Authorization: authHeader } : {},
  });

describe('validateBearerToken', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when Authorization header is missing', () => {
    const result = validateBearerToken(makeRequest());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(result.response.headers.get('WWW-Authenticate')).toContain(
        'Bearer',
      );
      expect(result.response.headers.get('WWW-Authenticate')).toContain(
        'resource_metadata',
      );
    }
  });

  it('returns 401 for non-Bearer auth scheme', () => {
    const result = validateBearerToken(makeRequest('Basic dXNlcjpwYXNz'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
      expect(result.response.headers.get('WWW-Authenticate')).toContain(
        'Bearer',
      );
    }
  });

  it('returns 401 when JWT is invalid', () => {
    mockedJwtDecode.mockImplementation(() => {
      throw new Error('Invalid token');
    });

    const result = validateBearerToken(makeRequest('Bearer bad.token.here'));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(401);
    }
  });

  it('returns auth context for valid JWT', () => {
    mockedJwtDecode.mockReturnValue({
      sub: 'user-123',
      email: 'test@84000.co',
      user_role: 'editor',
    });
    const mockClient = {} as DataClient;
    mockedCreateTokenClient.mockReturnValue(mockClient);

    const result = validateBearerToken(makeRequest('Bearer valid.jwt.token'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.client).toBe(mockClient);
      expect(result.userId).toBe('user-123');
      expect(result.email).toBe('test@84000.co');
      expect(result.role).toBe('editor');
    }
    expect(mockedCreateTokenClient).toHaveBeenCalledWith('valid.jwt.token');
  });

  it('defaults role to reader when user_role is missing', () => {
    mockedJwtDecode.mockReturnValue({ sub: 'user-456' });
    mockedCreateTokenClient.mockReturnValue({} as DataClient);

    const result = validateBearerToken(makeRequest('Bearer valid.jwt.token'));

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.role).toBe('reader');
    }
  });
});

describe('requirePermission', () => {
  beforeEach(() => jest.clearAllMocks());

  const client = {} as DataClient;

  it('returns ok when permission is granted', async () => {
    mockedHasPermission.mockResolvedValue(true);

    const result = await requirePermission(client, 'projects.read');

    expect(result.ok).toBe(true);
    expect(mockedHasPermission).toHaveBeenCalledWith({
      client,
      permission: 'projects.read',
    });
  });

  it('returns 403 when permission is denied', async () => {
    mockedHasPermission.mockResolvedValue(false);

    const result = await requirePermission(client, 'editor.admin');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.response.status).toBe(403);
      const body = await result.response.json();
      expect(body.error).toBe('forbidden');
    }
  });
});

describe('decodeRole', () => {
  beforeEach(() => jest.clearAllMocks());

  it('extracts role from JWT', () => {
    mockedJwtDecode.mockReturnValue({ user_role: 'admin' });
    expect(decodeRole('some.token')).toBe('admin');
  });

  it('defaults to reader when role is missing', () => {
    mockedJwtDecode.mockReturnValue({});
    expect(decodeRole('some.token')).toBe('reader');
  });

  it('defaults to reader on invalid token', () => {
    mockedJwtDecode.mockImplementation(() => {
      throw new Error('bad');
    });
    expect(decodeRole('bad')).toBe('reader');
  });
});

describe('ROLE_HIERARCHY', () => {
  it('lists roles from least to most privileged', () => {
    expect(ROLE_HIERARCHY).toEqual([
      'reader',
      'scholar',
      'translator',
      'editor',
      'admin',
    ]);
  });
});
