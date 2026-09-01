import { ApolloServer, HeaderMap } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { NextRequest, NextResponse } from 'next/server';
import depthLimit from 'graphql-depth-limit';
import { CONTENT_SOURCE_HEADER } from '@eightyfourthousand/data-access';

import { typeDefs, resolvers, createContext } from '../../../graphql';

/**
 * Headers a browser may send to this endpoint cross-origin.
 *
 * The reading room and the studio are on different origins to this API, so every
 * request is preflighted and anything not listed here is rejected before the
 * query runs. `CONTENT_SOURCE_HEADER` is spelled from the constant rather than
 * written out, because a mismatch between the two fails only cross-origin —
 * same-origin local work would keep passing while the reading room broke.
 */
const ALLOWED_REQUEST_HEADERS = [
  'Content-Type',
  'Authorization',
  'apollo-require-preflight',
  CONTENT_SOURCE_HEADER,
].join(', ');

/**
 * CORS headers for this endpoint. Deliberately static.
 *
 * These used to reflect the request's `Origin` back with
 * `Access-Control-Allow-Credentials: true`. Because the response carried no
 * `Vary: Origin`, Vercel's edge cached it and replayed it to other origins with
 * the wrong `Access-Control-Allow-Origin` — which Safari reports as "Fetch API
 * cannot load ... due to access control checks". A constant value cannot vary
 * by origin, so it cannot be poisoned by a cache and needs no `Vary`.
 *
 * Credentials are not part of the contract: the browser client
 * (`libs/client-graphql`) uses `graphql-request`, whose fetch defaults to
 * `credentials: 'same-origin'`, and authenticates with an `Authorization`
 * bearer token. The cookie fallback in `createContext` only ever fires
 * same-origin, where CORS does not apply. Dropping the credentials header is
 * what makes the `*` wildcard legal.
 *
 * `Access-Control-Max-Age` matters because every request to this endpoint is
 * preflighted — `apollo-require-preflight` and the content-source header are
 * both non-simple. Without it Safari, whose preflight cache is far
 * shorter-lived than Chrome's, pays two round-trips per query.
 */
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': ALLOWED_REQUEST_HEADERS,
  'Access-Control-Max-Age': '3600',
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  introspection: true,
  plugins: [ApolloServerPluginLandingPageLocalDefault({ embed: true })],
  validationRules: [depthLimit(12)],
});

// Ensure server is started
const serverStartPromise = server.start();

async function handler(req: NextRequest) {
  await serverStartPromise;

  const body = req.method === 'POST' ? await req.json() : {};

  // Convert headers to HeaderMap
  const headers = new HeaderMap();
  req.headers.forEach((value, key) => {
    headers.set(key, value);
  });

  const {
    body: responseBody,
    headers: responseHeaders,
    status,
  } = await server.executeHTTPGraphQLRequest({
    httpGraphQLRequest: {
      method: req.method,
      headers,
      body,
      search: req.nextUrl.search,
    },
    context: () => createContext(req),
  });

  const response = new NextResponse(
    responseBody.kind === 'complete' ? responseBody.string : null,
    { status },
  );

  for (const [key, value] of responseHeaders) {
    response.headers.set(key, value);
  }

  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    response.headers.set(key, value);
  }

  // GraphQL results are per-request and several carry viewer-scoped content, so
  // they must never sit in a shared cache. The framework default here is
  // `public`, which is what allowed the edge to cache this endpoint at all.
  response.headers.set('Cache-Control', 'no-store');

  return response;
}

function optionsHandler() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export { handler as GET, handler as POST, optionsHandler as OPTIONS };
