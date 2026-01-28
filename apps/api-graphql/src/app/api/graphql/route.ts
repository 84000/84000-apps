import { ApolloServer, HeaderMap } from '@apollo/server';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import { NextRequest, NextResponse } from 'next/server';
import depthLimit from 'graphql-depth-limit';

import { typeDefs, resolvers, createContext } from '../../../graphql';

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

  return response;
}

export { handler as GET, handler as POST };
