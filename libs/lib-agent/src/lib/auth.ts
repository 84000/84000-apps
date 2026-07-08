import { jwtDecode } from 'jwt-decode';
import {
  createTokenClient,
  hasPermission,
} from '@eightyfourthousand/data-access';
import type {
  DataClient,
  UserRole,
  UserPermission,
} from '@eightyfourthousand/data-access';
import { MCP_CORS_HEADERS } from './cors';

export type AuthSuccess = {
  ok: true;
  client: DataClient;
  userId: string;
  email: string;
  role: UserRole;
};

export type AuthFailure = {
  ok: false;
  response: Response;
};

export type AuthResult = AuthSuccess | AuthFailure;

export type PermissionResult = { ok: true } | { ok: false; response: Response };

export const ROLE_HIERARCHY: UserRole[] = [
  'reader',
  'scholar',
  'translator',
  'editor',
  'admin',
];

const createUnauthorizedResponse = (
  resourceMetadataUrl: string,
  message = 'Authentication required',
): Response =>
  new Response(JSON.stringify({ error: 'unauthorized', message }), {
    status: 401,
    headers: {
      ...MCP_CORS_HEADERS,
      'Content-Type': 'application/json',
      'WWW-Authenticate': `Bearer realm="84000-mcp", resource_metadata="${resourceMetadataUrl}"`,
    },
  });

const createForbiddenResponse = (
  message = 'Insufficient permissions',
): Response =>
  new Response(JSON.stringify({ error: 'forbidden', message }), {
    status: 403,
    headers: { ...MCP_CORS_HEADERS, 'Content-Type': 'application/json' },
  });

export const validateBearerToken = async (
  req: Request,
): Promise<AuthResult> => {
  // RFC 9728 requires resource_metadata to be an absolute URI
  const resourceMetadataUrl = new URL(
    '/.well-known/oauth-protected-resource',
    req.url,
  ).toString();

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return {
      ok: false,
      response: createUnauthorizedResponse(resourceMetadataUrl),
    };
  }

  const token = authHeader.substring(7);

  try {
    const client = createTokenClient(token);

    // Verify the token server-side; jwtDecode alone would accept forged or
    // expired tokens.
    const { data, error } = await client.auth.getUser(token);
    if (error || !data?.user) {
      return {
        ok: false,
        response: createUnauthorizedResponse(
          resourceMetadataUrl,
          'Invalid token',
        ),
      };
    }

    return {
      ok: true,
      client,
      userId: data.user.id,
      email: data.user.email ?? '',
      role: decodeRole(token),
    };
  } catch {
    return {
      ok: false,
      response: createUnauthorizedResponse(
        resourceMetadataUrl,
        'Invalid token',
      ),
    };
  }
};

export const requirePermission = async (
  client: DataClient,
  permission: UserPermission,
): Promise<PermissionResult> => {
  const allowed = await hasPermission({ client, permission });
  if (!allowed) {
    return { ok: false, response: createForbiddenResponse() };
  }
  return { ok: true };
};

export const decodeRole = (token: string): UserRole => {
  try {
    const decoded = jwtDecode<{ user_role?: UserRole }>(token);
    const role = decoded.user_role ?? 'reader';
    return ROLE_HIERARCHY.includes(role) ? role : 'reader';
  } catch {
    return 'reader';
  }
};
