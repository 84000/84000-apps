import { createServerClient } from '@eightyfourthousand/data-access/ssr';
import { NextResponse } from 'next/server';
import { safeNextPath } from '@eightyfourthousand/lib-utils';

export const authCallback = async (request: Request) => {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  // Validated rather than trusted: `next` arrives from the query string, so an
  // unchecked value would turn this callback into an open redirect.
  const next = safeNextPath(searchParams.get('next')) ?? '/';

  if (code) {
    const dataClient = await createServerClient();

    const { error } = await dataClient.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(`failed to create session ${error}`);
      return NextResponse.redirect(`${origin}/auth/auth-code-error`);
    }

    const forwardedHost = request.headers.get('x-forwarded-host');
    const isLocalEnv = process.env.NODE_ENV === 'development';

    if (isLocalEnv || !forwardedHost) {
      return NextResponse.redirect(`${origin}${next}`);
    }

    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }
};
