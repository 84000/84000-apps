import { createServerClient } from '@data-access/ssr';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

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
}
