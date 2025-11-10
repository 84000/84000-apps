import { createServerClient } from '@data-access/ssr';
import { type NextRequest, NextResponse } from 'next/server';

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // match tohoku catalog shortlinks like /toh1234
  if (pathname.match(/^\/toh\d+/)) {
    const url = request.nextUrl.clone();
    const toh = pathname.split('/')[1]?.split('.')[0];

    if (!toh) {
      return NextResponse.next();
    }

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
      url.pathname = `/${data.work_uuid}`;
      url.searchParams.set('toh', toh);
    }
    return NextResponse.redirect(url);
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
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
