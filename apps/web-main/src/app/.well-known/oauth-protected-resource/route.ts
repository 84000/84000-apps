import {
  MCP_CORS_HEADERS,
  corsPreflightResponse,
} from '@eightyfourthousand/lib-agent';

const headers = {
  ...MCP_CORS_HEADERS,
  'Content-Type': 'application/json',
  'Cache-Control': 'public, max-age=3600',
};

export async function OPTIONS() {
  return corsPreflightResponse();
}

export async function GET(req: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const { origin } = new URL(req.url);

  return new Response(
    JSON.stringify({
      resource: `${origin}/mcp`,
      authorization_servers: [`${supabaseUrl}/auth/v1`],
      bearer_methods_supported: ['header'],
      // openid is deliberately absent: ID-token signing requires asymmetric
      // JWT keys, and this project still signs with the legacy HS256 secret.
      // Clients that fall back to the authorization server's scopes_supported
      // would request openid and get a 500 at the token endpoint.
      scopes_supported: ['email', 'profile'],
    }),
    { headers },
  );
}
