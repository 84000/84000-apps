/**
 * The service_role client the pipeline runs as.
 *
 * Publishing needs credentials no user-scoped client has: the `translation-versions`
 * bucket carries no `storage.objects` policy at all, and `publish_jobs` grants writes
 * only to service_role.
 *
 * This deliberately lives in lib-publishing rather than data-access. data-access is
 * published to npm and consumed by public-reading-room and scholars-room; a service-role
 * factory does not belong in a package those apps install. Keeping it here also keeps the
 * key handling next to the only code that needs it.
 *
 * Authorization is still the caller's job: resolvers check `editor.admin` against the
 * REQUESTING user's client first, then hand the pipeline this one. Never derive
 * permission from the fact that this client can do anything.
 */

import { createClient } from '@supabase/supabase-js';
import type { DataClient } from '@eightyfourthousand/data-access';

/**
 * Reads `SUPABASE_SERVICE_ROLE_KEY`, falling back to `SUPABASE_SERVICE_KEY` — the name
 * the existing node-scripts already use, so a developer's .env keeps working.
 */
export const createServiceRoleClient = (): DataClient => {
  const url =
    process.env['SUPABASE_URL'] ?? process.env['NEXT_PUBLIC_SUPABASE_URL'];
  const key =
    process.env['SUPABASE_SERVICE_ROLE_KEY'] ??
    process.env['SUPABASE_SERVICE_KEY'];

  if (!url || !key) {
    throw new Error(
      'Publishing requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ' +
        'SUPABASE_SERVICE_KEY). The translation-versions bucket has no storage policy, ' +
        'so a user-scoped client cannot write artifacts.',
    );
  }

  // No session persistence or token refresh: this is a server-side, request-scoped client
  // with a static key, and persisting anything would be a cross-request leak.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};
