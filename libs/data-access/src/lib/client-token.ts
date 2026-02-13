import { createClient } from '@supabase/supabase-js';
import type { DataClient } from './types/client';

/**
 * Create a Supabase client using an access token for authentication.
 * Use this for API routes that receive tokens via Authorization header
 * instead of cookies (e.g., cross-domain requests).
 */
export const createTokenClient = (accessToken: string): DataClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};
