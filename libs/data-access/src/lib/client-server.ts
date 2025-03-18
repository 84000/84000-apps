import {
  CookieMethodsServer,
  createServerClient as createSupabaseClient,
} from '@supabase/ssr';

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

  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    cookies,
  });
};
