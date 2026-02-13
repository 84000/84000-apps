import { createServerClient } from '@data-access/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Remove the /reader prefix to get the local path within this app
  const localPath = pathname.replace(/^\/reader/, '') || '/';

  // match tohoku catalog shortlinks like /reader/toh1234
  if (localPath.match(/^\/toh\d+/)) {
    const url = request.nextUrl.clone();
    const toh = localPath.split('/').at(-1)?.split('.')[0];

    if (toh) {
      const client = await createServerClient();
      const { data, error } = await client
        .from('work_toh')
        .select('work_uuid')
        .eq('toh_clean', toh)
        .single();

      if (error || !data) {
        return NextResponse.next();
      }

      if (data?.work_uuid) {
        url.pathname = `/reader/${data.work_uuid}`;
        url.searchParams.set('toh', toh);
      }
      return NextResponse.redirect(url);
    }
  }

  // Check for knowledgebase in the local path
  const isKnowledgeBase = localPath.startsWith('/knowledgebase');
  if (isKnowledgeBase) {
    return NextResponse.redirect(new URL(localPath, 'https://84000.co'));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths under /reader except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - icon and apple-touch-icon files
     */
    '/reader/((?!_next/static|_next/image|favicon.ico|icon.png|apple-touch-icon.png|apple-touch-icon-precomposed.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
