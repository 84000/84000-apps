import {
  CookieMethodsServer,
  createServerClient as createSupabaseClient,
} from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import type { DataClient } from './types/client';

export const createAnonServerClient = (): DataClient => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

export const createServerClient = ({
  cookies,
}: {
  cookies: CookieMethodsServer;
}) => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase credentials');
  }

  const client = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    cookies,
  });

  // NOTE: we suppress the warning about getSession being called. But is is
  // import not to rely on this method for authorization. Rather, it is
  // convenient for early exists in server components.
  //
  // @ts-expect-error - suppressGetSessionWarning is protected
  client.auth.suppressGetSessionWarning = true;

  return client;
};
