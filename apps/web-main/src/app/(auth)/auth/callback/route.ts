import { createServerClient } from '@data-access';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const cookieStore = await cookies();
    const dataClient = createServerClient({
      cookies: {
        getAll: () => {
          return cookieStore.getAll();
        },
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    });

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
