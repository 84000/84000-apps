const headers = {
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600',
};

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const resource = new URL(req.url).origin;

  return new Response(
    JSON.stringify({
      resource,
      authorization_servers: [`${supabaseUrl}/auth/v1`],
      bearer_methods_supported: ['header'],
      scopes_supported: [],
    }),
    { headers },
  );
}
