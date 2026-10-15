import { test as setup } from '@playwright/test';
import { createServerClient } from '@supabase/ssr';
import { db } from './support/db';
import {
  BASE_URL,
  localStack,
  STORAGE_STATE,
  TEST_USER_EMAIL,
} from './support/local-stack';

/**
 * Signs in as a seeded local account without a password: the service role
 * mints a magic link, and verifying it through the same SSR client web-main
 * uses writes the session cookies the app expects.
 */
setup('sign in to the local studio', async ({ context }) => {
  const { apiUrl, anonKey } = localStack();

  const { data: link, error: linkError } = await db().auth.admin.generateLink({
    type: 'magiclink',
    email: TEST_USER_EMAIL,
  });
  if (linkError || !link.properties) {
    throw new Error(`generateLink failed: ${linkError?.message}`);
  }

  const jar = new Map<string, string>();
  const supabase = createServerClient(apiUrl, anonKey, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) =>
        cookies.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { error } = await supabase.auth.verifyOtp({
    token_hash: link.properties.hashed_token,
    type: 'magiclink',
  });
  if (error) throw new Error(`verifyOtp failed: ${error.message}`);

  const { hostname } = new URL(BASE_URL);
  await context.addCookies(
    [...jar].map(([name, value]) => ({
      name,
      value,
      domain: hostname,
      path: '/',
      sameSite: 'Lax' as const,
    })),
  );
  await context.storageState({ path: STORAGE_STATE });
});
