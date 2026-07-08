/**
 * CORS headers for MCP and OAuth discovery endpoints. Browser-based MCP
 * clients (MCP Inspector, claude.ai) fetch these cross-origin; bearer-token
 * auth means wildcard origins are safe. 'Access-Control-Allow-Headers' must
 * list Authorization explicitly — the '*' wildcard doesn't cover it.
 */
export const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers':
    'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-Id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
  'Access-Control-Max-Age': '3600',
};

export const corsPreflightResponse = (): Response =>
  new Response(null, { status: 204, headers: MCP_CORS_HEADERS });

export const withCorsHeaders = (res: Response): Response => {
  const headers = new Headers(res.headers);
  Object.entries(MCP_CORS_HEADERS).forEach(([key, value]) =>
    headers.set(key, value),
  );
  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  });
};
