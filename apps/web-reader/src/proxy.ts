import { getWorkUuidByToh } from '@eightyfourthousand/data-access';
import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // match tohoku catalog shortlinks like /toh1234
  if (pathname.match(/^\/toh\d+/)) {
    const url = request.nextUrl.clone();
    const toh = pathname.split('/')[1]?.split('.')[0];

    if (toh) {
      const client = await createServerClient();
      const workUuid = await getWorkUuidByToh({ client, toh });

      if (!workUuid) {
        return NextResponse.next();
      }

      url.pathname = `/${workUuid}`;
      url.searchParams.set('toh', toh);
      return NextResponse.redirect(url);
    }
  }

  const isKnowledgeBase = pathname.startsWith('/knowledgebase');
  if (isKnowledgeBase) {
    return NextResponse.redirect(new URL(pathname, 'https://84000.co'));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon and apple-touch-icon files
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.png|apple-touch-icon.png|apple-touch-icon-precomposed.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
