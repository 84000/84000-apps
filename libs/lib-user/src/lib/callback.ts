import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { NextResponse } from 'next/server';
import { safeNextPath } from '@eightyfourthousand/lib-utils';
import { AUTH_FAILED_ERROR } from './types';

const baseUrl = (request: Request, origin: string) => {
  const forwardedHost = request.headers.get('x-forwarded-host');
  const isLocalEnv = process.env.NODE_ENV === 'development';
  return isLocalEnv || !forwardedHost ? origin : `https://${forwardedHost}`;
};

/**
 * Completes an OAuth sign-in by exchanging the provider's code for a session,
 * then redirects to the `next` path.
 */
export const authCallback = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Validated rather than trusted: `next` arrives from the query string, so an
  // unchecked value would turn this callback into an open redirect.
  const next = safeNextPath(searchParams.get('next')) ?? '/';
  const base = baseUrl(request, origin);

  const dataClient = await createServerClient();

  if (code) {
    const { error } = await dataClient.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${base}${next}`);
    }
    console.error(`failed to create session ${error}`);
  } else {
    const reason =
      searchParams.get('error_description') ?? searchParams.get('error');
    console.error(
      `auth callback without a code: ${reason?.slice(0, 200) ?? 'no reason'}`,
    );
  }

  // A repeated callback fails its exchange after an earlier one already
  // signed the user in, so an existing session still goes to `next`.
  const {
    data: { user },
  } = await dataClient.auth.getUser();
  if (user) {
    return NextResponse.redirect(`${base}${next}`);
  }

  const login = new URL('/login', base);
  if (next !== '/') {
    login.searchParams.set('next', next);
  }
  login.searchParams.set('error', AUTH_FAILED_ERROR);
  return NextResponse.redirect(login);
};
