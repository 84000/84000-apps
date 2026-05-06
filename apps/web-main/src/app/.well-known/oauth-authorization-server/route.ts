const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600',
};

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const authBase = `${supabaseUrl}/auth/v1`;

  return new Response(
    JSON.stringify({
      issuer: authBase,
      authorization_endpoint: `${authBase}/authorize`,
      token_endpoint: `${authBase}/token?grant_type=pkce`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: ['none'],
    }),
    { headers },
  );
}
