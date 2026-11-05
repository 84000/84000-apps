import {
  canonicalToh,
  contentSourceFromEnv,
} from '@eightyfourthousand/data-access';
import {
  createAnonServerClient,
  lookupEntityWithClient,
} from '@eightyfourthousand/data-access/ssr';
import { isUuid } from '@eightyfourthousand/lib-utils';
import { type NextRequest, NextResponse } from 'next/server';

const TOH_PATH = /^\/(?:translation\/)?(toh[^/]+)$/i;
const WORK_PATH = /^\/translation\/([^/]+)$/;

/** The path segment for a link that names no Toh: the work's first is read. */
const NO_TOH = 'default';

/**
 * Redirects Toh links (`/toh8`, `/translation/toh8`) to the work's uuid,
 * keeping the query so panel and highlight parameters survive. Done here
 * rather than in the layout, which cannot read the query.
 *
 * A work's page is rewritten to carry `?toh=` in its path, where the layout can
 * read it, so the server draws the reading the link names. The address shown
 * is unchanged.
 */
export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  const work = pathname.match(WORK_PATH);
  if (work && isUuid(work[1])) {
    // Only a catalogued Toh reaches the path; anything else reads the default.
    const toh = canonicalToh(searchParams.get('toh')) ?? NO_TOH;
    const url = request.nextUrl.clone();
    url.pathname = `${pathname}/${encodeURIComponent(toh)}`;
    return NextResponse.rewrite(url);
  }

  const match = pathname.match(TOH_PATH);
  if (!match) {
    return NextResponse.next();
  }

  const { path } = await lookupEntityWithClient({
    client: createAnonServerClient(),
    type: 'translation',
    entity: match[1],
    prefix: '/translation',
    searchParams: new URLSearchParams(searchParams),
    source: contentSourceFromEnv(),
  });

  // Unknown Toh: fall through to the reader route, which 404s.
  if (!path) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL(path, request.url));
}

export const config = {
  matcher: [
    '/:slug(toh[^/]*)',
    '/translation/:slug(toh[^/]*)',
    // A work's page, by uuid.
    '/translation/:slug([0-9a-fA-F-]+)',
  ],
};
