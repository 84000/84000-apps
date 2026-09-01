import { updateSession } from '@eightyfourthousand/data-access/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  // A CORS preflight carries no credentials and its response is discarded by
  // the browser once the headers are read, so refreshing the session here buys
  // nothing and costs a Supabase round-trip. Every request to /api/graphql is
  // preflighted (`apollo-require-preflight` and the content-source header are
  // non-simple), so on Safari — which re-preflights far more often than Chrome —
  // this doubled the auth round-trips for the whole reader.
  if (request.method === 'OPTIONS') {
    return NextResponse.next();
  }

  // Update session to refresh auth cookies
  const { supabaseResponse } = await updateSession(request);

  // Return the response with refreshed cookies
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
