import {
  isTohRequest,
  isXmlidRequest,
  redirectOnToh,
  redirectOnXmlid,
} from '@eightyfourthousand/lib-editing';
import { type NextRequest, NextResponse } from 'next/server';

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // match tohoku catalog shortlinks like /toh1234
  if (isTohRequest(pathname)) {
    return redirectOnToh(pathname, request);
  }

  // match xmlid shortlinks like /UT22084-001-001
  if (isXmlidRequest(pathname)) {
    return redirectOnXmlid(pathname, request);
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
