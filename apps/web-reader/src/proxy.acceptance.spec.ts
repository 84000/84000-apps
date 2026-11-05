/**
 * @jest-environment node
 *
 * Acceptance tests for DEV-837 item 6a, section 4: web-reader routing in
 * `src/proxy.ts` (AC6.8 to AC6.11).
 *
 * Written from the spec, not the implementation. Only the data reads are
 * faked (`createAnonServerClient` and `lookupEntityWithClient`); the proxy runs
 * against real `NextRequest` and `NextResponse` objects.
 */
import { NextRequest } from 'next/server';
import { config, proxy } from './proxy';

// Next's own matcher compiler, which has no types.
const { pathToRegexp } = jest.requireActual(
  'next/dist/compiled/path-to-regexp',
) as { pathToRegexp: (source: string) => RegExp };

jest.mock('@eightyfourthousand/data-access', () => ({
  ...jest.requireActual('@eightyfourthousand/data-access'),
  contentSourceFromEnv: jest.fn(() => 'draft'),
}));

jest.mock('@eightyfourthousand/data-access/ssr', () => ({
  createAnonServerClient: jest.fn(),
  lookupEntityWithClient: jest.fn(),
}));

const ssr = jest.requireMock('@eightyfourthousand/data-access/ssr') as {
  createAnonServerClient: jest.Mock;
  lookupEntityWithClient: jest.Mock;
};

const ORIGIN = 'http://localhost:3002';
const WORK = '1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed';

const request = (pathAndQuery: string) =>
  new NextRequest(`${ORIGIN}${pathAndQuery}`);

/** Where a rewrite sends the request, or undefined if it is not a rewrite. */
const rewrittenTo = (response: Response) => {
  const header = response.headers.get('x-middleware-rewrite');
  return header ? new URL(header, ORIGIN) : undefined;
};

/** Where a redirect sends the request, or undefined if it is not a redirect. */
const redirectedTo = (response: Response) => {
  const header = response.headers.get('location');
  return header ? new URL(header, ORIGIN) : undefined;
};

const passedThrough = (response: Response) =>
  response.headers.get('x-middleware-next') === '1';

beforeEach(() => {
  ssr.createAnonServerClient.mockReset().mockReturnValue({ name: 'anon' });
  // Resolves a Toh to the work, and builds the path the way the real lookup
  // does: the prefix, the work and the query it was given.
  ssr.lookupEntityWithClient
    .mockReset()
    .mockImplementation(
      async ({
        entity,
        prefix,
        searchParams,
      }: {
        entity: string;
        prefix?: string;
        searchParams?: URLSearchParams;
      }) =>
        entity === 'toh8'
          ? { path: `${prefix ?? ''}/${WORK}?${searchParams ?? ''}` }
          : {},
    );
});

describe('proxy rewrites a work path to its Toh segment', () => {
  it('AC6.8: rewrites /translation/<uuid>?toh=toh847 to /translation/<uuid>/toh847, keeping the query', async () => {
    const response = await proxy(request(`/translation/${WORK}?toh=toh847`));

    const target = rewrittenTo(response);
    expect(target?.pathname).toBe(`/translation/${WORK}/toh847`);
    expect(target?.searchParams.get('toh')).toBe('toh847');
  });

  it('AC6.8: is a rewrite, not a redirect, so the address shown does not change', async () => {
    const response = await proxy(request(`/translation/${WORK}?toh=toh847`));

    expect(redirectedTo(response)).toBeUndefined();
    expect(response.status).toBe(200);
    expect(passedThrough(response)).toBe(false);
    expect(rewrittenTo(response)).toBeDefined();
  });

  it('AC6.8: keeps the other query parameters', async () => {
    const response = await proxy(
      request(`/translation/${WORK}?toh=toh847&left=open%3Atoc`),
    );

    const target = rewrittenTo(response);
    expect(target?.pathname).toBe(`/translation/${WORK}/toh847`);
    expect(target?.searchParams.get('toh')).toBe('toh847');
    expect(target?.searchParams.get('left')).toBe('open:toc');
  });

  it('AC6.9: rewrites /translation/<uuid> with no toh to /translation/<uuid>/default', async () => {
    const response = await proxy(request(`/translation/${WORK}`));

    expect(rewrittenTo(response)?.pathname).toBe(
      `/translation/${WORK}/default`,
    );
    expect(redirectedTo(response)).toBeUndefined();
  });

  it('AC6.9: rewrites a toh that is not toh… to /default', async () => {
    const response = await proxy(
      request(`/translation/${WORK}?toh=${encodeURIComponent('evil/../x')}`),
    );

    const target = rewrittenTo(response);
    expect(target?.pathname).toBe(`/translation/${WORK}/default`);
    expect(target?.pathname).not.toContain('evil');
  });

  it('AC6.9: rewrites an empty toh to /default', async () => {
    const response = await proxy(request(`/translation/${WORK}?toh=`));

    expect(rewrittenTo(response)?.pathname).toBe(
      `/translation/${WORK}/default`,
    );
  });

  it('AC6.9: keeps the other query parameters when there is no toh', async () => {
    const response = await proxy(
      request(`/translation/${WORK}?left=open%3Atoc`),
    );

    const target = rewrittenTo(response);
    expect(target?.pathname).toBe(`/translation/${WORK}/default`);
    expect(target?.searchParams.get('left')).toBe('open:toc');
  });
});

describe('proxy redirects a Toh link to the work', () => {
  it('AC6.10: redirects /translation/toh8 to the work, keeping the query', async () => {
    const response = await proxy(request('/translation/toh8?left=open%3Atoc'));

    const target = redirectedTo(response);
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(target?.pathname).toBe(`/translation/${WORK}`);
    expect(target?.searchParams.get('left')).toBe('open:toc');
    expect(rewrittenTo(response)).toBeUndefined();
  });

  it('AC6.10: redirects /toh8 to the work, keeping the query', async () => {
    const response = await proxy(request('/toh8?left=open%3Atoc'));

    const target = redirectedTo(response);
    expect(response.status).toBeGreaterThanOrEqual(300);
    expect(response.status).toBeLessThan(400);
    expect(target?.pathname).toBe(`/translation/${WORK}`);
    expect(target?.searchParams.get('left')).toBe('open:toc');
  });

  it('AC6.10: looks the Toh up as a translation with the request query', async () => {
    await proxy(request('/translation/toh8?left=open%3Atoc'));

    expect(ssr.lookupEntityWithClient).toHaveBeenCalledTimes(1);
    const options = ssr.lookupEntityWithClient.mock.calls[0][0];
    expect(options).toEqual(
      expect.objectContaining({
        type: 'translation',
        entity: 'toh8',
        prefix: '/translation',
      }),
    );
    expect(options.searchParams.get('left')).toBe('open:toc');
  });

  it('AC6.10: a Toh it cannot find falls through', async () => {
    const response = await proxy(request('/translation/toh999999'));

    expect(passedThrough(response)).toBe(true);
    expect(redirectedTo(response)).toBeUndefined();
    expect(rewrittenTo(response)).toBeUndefined();
  });

  it('AC6.10: a short /toh link it cannot find falls through', async () => {
    const response = await proxy(request('/toh999999'));

    expect(passedThrough(response)).toBe(true);
    expect(redirectedTo(response)).toBeUndefined();
    expect(rewrittenTo(response)).toBeUndefined();
  });
});

describe('proxy config', () => {
  const sources = (
    Array.isArray(config.matcher) ? config.matcher : [config.matcher]
  ).map((matcher) =>
    typeof matcher === 'string'
      ? matcher
      : (matcher as { source: string }).source,
  );

  const matches = (pathname: string) =>
    sources.some((source) => pathToRegexp(source).test(pathname));

  it('AC6.11: matcher covers /translation/<uuid>', () => {
    expect(matches(`/translation/${WORK}`)).toBe(true);
  });

  it('AC6.11: matcher still covers the Toh links', () => {
    expect(matches('/toh8')).toBe(true);
    expect(matches('/translation/toh8')).toBe(true);
  });
});
