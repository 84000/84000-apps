/**
 * Test-only helpers for driving the sync path against a local Supabase stack.
 *
 * Excluded from the library build (see `tsconfig.lib.json`) — nothing here ships.
 *
 * The JWT is minted rather than obtained by logging in because `web-main`'s
 * login is social-only (`EMAIL_AUTH_ENABLED` is hard-coded false), so no
 * headless sign-in exists against the local stack. Signing a token with the
 * local JWT secret and a `user_role` claim exercises `public.authorize` — and
 * therefore the real RLS policies — for real. Varying the claim tests the gates
 * in both directions, which is the point: an RLS mistake that admits everyone
 * looks identical to correct behaviour from a single privileged client.
 */

import { createHmac } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const LOCAL_SUPABASE_URL =
  process.env.LOCAL_SUPABASE_URL ?? 'http://127.0.0.1:54321';

export const LOCAL_ANON_KEY =
  process.env.LOCAL_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

export const LOCAL_JWT_SECRET =
  process.env.LOCAL_SUPABASE_JWT_SECRET ??
  'super-secret-jwt-token-with-at-least-32-characters-long';

const base64Url = (input: Buffer | string): string =>
  (typeof input === 'string' ? Buffer.from(input) : input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

export const signLocalJwt = (claims: Record<string, unknown>): string => {
  const header = base64Url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64Url(
    JSON.stringify({
      iss: 'supabase-demo',
      role: 'authenticated',
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
      ...claims,
    }),
  );
  const signature = base64Url(
    createHmac('sha256', LOCAL_JWT_SECRET)
      .update(`${header}.${payload}`)
      .digest(),
  );
  return `${header}.${payload}.${signature}`;
};

/**
 * A client authenticated as an editor.
 *
 * `accessToken` feeds the Realtime socket as well as PostgREST, which matters:
 * a private channel authorizes its join against `realtime.messages` RLS using
 * that token, so passing it only in the REST headers would produce a client
 * that can write the log and never receive anything.
 */
export const createEditorClient = (
  claims: Record<string, unknown> = {},
): SupabaseClient => {
  const token = signLocalJwt({
    sub: '00000000-0000-4000-8000-000000000001',
    user_role: 'admin',
    ...claims,
  });

  return createClient(LOCAL_SUPABASE_URL, LOCAL_ANON_KEY, {
    accessToken: async () => token,
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 100 } },
  });
};

export const createServiceClient = (): SupabaseClient =>
  createClient(
    LOCAL_SUPABASE_URL,
    process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY ??
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

/**
 * Is a local stack listening?
 *
 * The convergence suite needs a real Realtime server, which CI does not have,
 * so it skips rather than fails when the stack is down. A skip that scrolls
 * past unnoticed reads as a pass, so the suite logs loudly when it takes this
 * branch — see `convergence.spec.ts`.
 */
export const localStackAvailable = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${LOCAL_SUPABASE_URL}/rest/v1/`, {
      headers: { apikey: LOCAL_ANON_KEY },
      signal: AbortSignal.timeout(2000),
    });
    return response.status < 500;
  } catch {
    return false;
  }
};

/** A real work from the seed, to satisfy the foreign keys. */
export const pickSeedWork = async (
  client: SupabaseClient,
): Promise<string> => {
  const { data, error } = await client
    .from('works')
    .select('uuid')
    .limit(1)
    .single();

  if (error || !data) {
    throw new Error(`could not pick a seed work: ${error?.message}`);
  }

  return data.uuid;
};

/**
 * A throwaway passage owned by one test.
 *
 * Tests must not share a passage. The log is durable by design, so a passage
 * reused across runs accumulates the previous run's updates and the next run's
 * catch-up faithfully replays them — two documents still *converge*, so the
 * state-vector assertion stays green while the text quietly contains two copies
 * of everything. That is a false pass on precisely the property under test, and
 * it is what the first smoke run actually did.
 *
 * Dropping the passage cascades to `passage_doc_updates` and
 * `passage_doc_snapshots`, so cleanup is one delete.
 */
export const createTestPassage = async (
  service: SupabaseClient,
  workUuid: string,
): Promise<string> => {
  const { data, error } = await service
    .from('passages')
    .insert({
      work_uuid: workUuid,
      type: 'paragraph',
      label: 'dev-707-sync-spike',
      content: '',
    })
    .select('uuid')
    .single();

  if (error || !data) {
    throw new Error(`could not create test passage: ${error?.message}`);
  }

  return data.uuid;
};

export const dropTestPassage = async (
  service: SupabaseClient,
  passageUuid: string,
): Promise<void> => {
  await service.from('passages').delete().eq('uuid', passageUuid);
};

/** Rows currently in the log for a passage — write-amplification measurement. */
export const countLogRows = async (
  service: SupabaseClient,
  passageUuid: string,
): Promise<number> => {
  const { count, error } = await service
    .from('passage_doc_updates')
    .select('seq', { count: 'exact', head: true })
    .eq('passage_uuid', passageUuid);

  if (error) throw new Error(`count failed: ${error.message}`);
  return count ?? 0;
};

/** Total stored update bytes for a passage. */
export const logByteSize = async (
  service: SupabaseClient,
  passageUuid: string,
): Promise<number> => {
  const { data, error } = await service
    .from('passage_doc_updates')
    .select('update')
    .eq('passage_uuid', passageUuid);

  if (error) throw new Error(`byte size failed: ${error.message}`);

  // PostgREST renders bytea as `\x<hex>`: two characters per stored byte.
  return (data ?? []).reduce(
    (total, row) => total + ((row.update as string).length - 2) / 2,
    0,
  );
};
