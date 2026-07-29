/**
 * Configuration module for node scripts.
 *
 * Loads environment variables and initializes a Supabase client
 * with service-level credentials for database operations.
 */

import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

/**
 * Loads environment configuration and creates a Supabase client.
 *
 * @returns An object containing:
 *   - supabase: Authenticated Supabase client using service key
 *   - pageSize: Default batch size for paginated queries (100)
 */
export const loadConfig = () => {
  config();

  const SUPABASE_URL = process.env['SUPABASE_URL'];
  const SUPABASE_SERVICE_KEY = process.env['SUPABASE_SERVICE_KEY'];

  // Fail with something readable rather than handing undefined to createClient,
  // which otherwise surfaces much later as an opaque request error.
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    const missing = [
      !SUPABASE_URL && 'SUPABASE_URL',
      !SUPABASE_SERVICE_KEY && 'SUPABASE_SERVICE_KEY',
    ].filter(Boolean);
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them in apps/node-scripts/.env or the environment.',
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return {
    supabase,
    pageSize: 100,
  };
};
