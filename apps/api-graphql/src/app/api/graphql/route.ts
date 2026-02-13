import { ApolloServer, HeaderMap } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { NextRequest, NextResponse } from 'next/server';
import depthLimit from 'graphql-depth-limit';

import { typeDefs, resolvers, createContext } from '../../../graphql';

function getCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get('origin') || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, apollo-require-preflight',
  };
}

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

  const corsHeaders = getCorsHeaders(req);

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

  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}

function optionsHandler(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: getCorsHeaders(req),
  });
}

export { handler as GET, handler as POST, optionsHandler as OPTIONS };
