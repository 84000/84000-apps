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
      scopes_supported: [],
    }),
    { headers },
  );
}
