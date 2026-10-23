/**
 * @jest-environment node
 */
import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { authCallback } from './callback';

jest.mock('@eightyfourthousand/data-access/ssr', () => ({
  createServerClient: jest.fn(),
}));

const mockedCreateServerClient = jest.mocked(createServerClient);

const CONSENT = '/oauth/authorize?authorization_id=abc';

const setup = ({
  exchangeError = null,
  user = null,
}: {
  exchangeError?: Error | null;
  user?: { id: string } | null;
} = {}) => {
  const exchangeCodeForSession = jest
    .fn()
    .mockResolvedValue({ error: exchangeError });
  const getUser = jest.fn().mockResolvedValue({ data: { user } });
  mockedCreateServerClient.mockResolvedValue({
    auth: { exchangeCodeForSession, getUser },
  } as unknown as Awaited<ReturnType<typeof createServerClient>>);
  return { exchangeCodeForSession, getUser };
};

const callback = (query: Record<string, string>) => {
  const url = new URL('https://studio.example/auth/callback');
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return authCallback(new Request(url));
};

const location = (res: Response) => res.headers.get('location');

beforeEach(() => {
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('authCallback', () => {
  it('redirects to next after a successful exchange', async () => {
    const { exchangeCodeForSession, getUser } = setup();

    const res = await callback({ code: 'c', next: CONSENT });

    expect(exchangeCodeForSession).toHaveBeenCalledWith('c');
    expect(getUser).not.toHaveBeenCalled();
    expect(location(res)).toBe(`https://studio.example${CONSENT}`);
  });

  it('honours x-forwarded-host outside development', async () => {
    setup();
    const url = 'https://internal.example/auth/callback?code=c&next=/x';

    const res = await authCallback(
      new Request(url, { headers: { 'x-forwarded-host': 'studio.example' } }),
    );

    expect(location(res)).toBe('https://studio.example/x');
  });

  it('sends a failed exchange with a session on to next', async () => {
    setup({ exchangeError: new Error('verifier missing'), user: { id: 'u' } });

    const res = await callback({ code: 'c', next: CONSENT });

    expect(location(res)).toBe(`https://studio.example${CONSENT}`);
  });

  it('sends a failed exchange without a session to login', async () => {
    setup({ exchangeError: new Error('verifier missing') });

    const res = await callback({ code: 'c', next: CONSENT });

    const target = new URL(location(res) ?? '');
    expect(target.pathname).toBe('/login');
    expect(target.searchParams.get('next')).toBe(CONSENT);
    expect(target.searchParams.get('error')).toBe('auth_failed');
  });

  it('responds to a callback without a code', async () => {
    const { exchangeCodeForSession } = setup();

    const res = await callback({ error: 'access_denied' });

    expect(exchangeCodeForSession).not.toHaveBeenCalled();
    expect(location(res)).toBe(
      'https://studio.example/login?error=auth_failed',
    );
  });

  it('sends a callback without a code but with a session on to next', async () => {
    setup({ user: { id: 'u' } });

    const res = await callback({ next: CONSENT });

    expect(location(res)).toBe(`https://studio.example${CONSENT}`);
  });

  it('ignores an unsafe next', async () => {
    setup();

    const res = await callback({ code: 'c', next: '//evil.example' });

    expect(location(res)).toBe('https://studio.example/');
  });
});
