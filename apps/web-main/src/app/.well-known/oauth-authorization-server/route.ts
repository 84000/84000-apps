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

// Older MCP clients look for authorization-server metadata on the resource
// origin, so mirror Supabase's discovery document rather than hardcoding
// endpoints that can drift.
export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    const res = await fetch(
      `${supabaseUrl}/auth/v1/.well-known/oauth-authorization-server`,
      { next: { revalidate: 3600 } },
    );
    if (!res.ok) {
      console.error(
        `Failed to fetch Supabase OAuth discovery metadata: ${res.status}`,
      );
      return new Response(JSON.stringify({ error: 'metadata_unavailable' }), {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(await res.json()), { headers });
  } catch (err) {
    console.error('Failed to fetch Supabase OAuth discovery metadata:', err);
    return new Response(JSON.stringify({ error: 'metadata_unavailable' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
