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

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  return {
    supabase,
    pageSize: 100,
  };
};
