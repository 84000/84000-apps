import { jwtDecode } from 'jwt-decode';
import { createTokenClient, hasPermission } from '@eightyfourthousand/data-access';
import type {
  DataClient,
  UserRole,
  UserPermission,
} from '@eightyfourthousand/data-access';

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
  message = 'Authentication required',
): Response =>
  new Response(JSON.stringify({ error: 'unauthorized', message }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate':
        'Bearer realm="84000-mcp", resource_metadata="/.well-known/oauth-protected-resource"',
    },
  });

const createForbiddenResponse = (
  message = 'Insufficient permissions',
): Response =>
  new Response(JSON.stringify({ error: 'forbidden', message }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });

export const validateBearerToken = (req: Request): AuthResult => {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return { ok: false, response: createUnauthorizedResponse() };
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwtDecode<{
      sub: string;
      email?: string;
      user_role?: UserRole;
    }>(token);

    const client = createTokenClient(token);
    const role = decoded.user_role ?? 'reader';

    return {
      ok: true,
      client,
      userId: decoded.sub,
      email: decoded.email ?? '',
      role: ROLE_HIERARCHY.includes(role) ? role : 'reader',
    };
  } catch {
    return {
      ok: false,
      response: createUnauthorizedResponse('Invalid token'),
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
