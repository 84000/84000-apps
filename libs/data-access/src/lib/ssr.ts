import { createServerClient as createSupabaseClient } from './client-server';
import { cookies } from 'next/headers';

export const createServerClient = async () => {
  const cookieStore = await cookies();
  return createSupabaseClient({
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
};
