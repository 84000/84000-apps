import { contentSourceFromEnv } from '@eightyfourthousand/data-access';
import {
  createAnonServerClient,
  lookupEntityWithClient,
} from '@eightyfourthousand/data-access/ssr';
import { type NextRequest, NextResponse } from 'next/server';

const TOH_PATH = /^\/(?:translation\/)?(toh[^/]+)$/i;

/**
 * Redirects Toh links (`/toh8`, `/translation/toh8`) to the work's uuid,
 * keeping the query so panel and highlight parameters survive. Done here
 * rather than in the layout, which cannot read the query.
 */
export async function proxy(request: NextRequest) {
  const match = request.nextUrl.pathname.match(TOH_PATH);
  if (!match) {
    return NextResponse.next();
  }

  const query = new URLSearchParams(request.nextUrl.searchParams);
  const xmlId = query.get('xmlId') || undefined;
  query.delete('xmlId');

  const { path } = await lookupEntityWithClient({
    client: createAnonServerClient(),
    type: 'translation',
    entity: match[1],
    prefix: '/translation',
    xmlId,
    searchParams: query,
    source: contentSourceFromEnv(),
  });

  // Unknown Toh: fall through to the reader route, which 404s.
  if (!path) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(path, request.url));
}

export const config = {
  matcher: ['/:slug(toh[^/]*)', '/translation/:slug(toh[^/]*)'],
};
