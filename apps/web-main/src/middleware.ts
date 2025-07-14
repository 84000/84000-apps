import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@data-access';

const PUBLIC_ROUTES = ['/login', '/auth'];
const RESTRICTED_ROUTES = ['/publications/editor', '/project'];

type RestrictedRoute = (typeof RESTRICTED_ROUTES)[number];
const RESTRICTED_ROUTE_ROLES: Record<RestrictedRoute, string[]> = {
  '/publications/editor': ['admin', 'editor', 'translator'],
  '/project': ['admin', 'editor', 'translator'],
};

export async function middleware(request: NextRequest) {
  const { user, role, supabaseResponse } = await updateSession(request);

  const pathname = request.nextUrl.pathname;
  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route),
  );

  if (!user && !isPublicRoute) {
    // no user, potentially respond by redirecting the user to the login page
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  const restrictedRoute = RESTRICTED_ROUTES.find((route) =>
    pathname.startsWith(route),
  );
  const isRestrictedRoute = !!restrictedRoute;
  const hasRequiredRole = isRestrictedRoute
    ? RESTRICTED_ROUTE_ROLES[restrictedRoute]?.includes(role)
    : true;

  if (isRestrictedRoute && !hasRequiredRole) {
    const url = request.nextUrl.clone();
    url.pathname = '/not-found';
    const redirect = NextResponse.redirect(url);
    const cookies = supabaseResponse.cookies.getAll();
    cookies.forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value, cookie);
    });
    return redirect;
  }

  return supabaseResponse;
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
