import type { NextRequest } from 'next/server';
import { createServerClient, getSession } from '@data-access';
import type { DataClient, UserClaims, UserRole } from '@data-access';
import { createClient } from '@supabase/supabase-js';
import { jwtDecode } from 'jwt-decode';
import { createLoaders, type Loaders } from './loaders';

export interface GraphQLContext {
  req: NextRequest;
  supabase: DataClient;
  loaders: Loaders;
  session: {
    claims: UserClaims;
    userId: string;
    email: string;
  } | null;
}

export async function createContext(req: NextRequest): Promise<GraphQLContext> {
  // First, try to get session from Authorization header (for cross-domain requests)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const decoded = jwtDecode<{
        sub: string;
        email?: string;
        user_role?: UserRole;
      }>(token);

      // Create Supabase client with the access token
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      ) as DataClient;

      const session = {
        claims: { role: decoded.user_role || 'reader' },
        userId: decoded.sub,
        email: decoded.email || '',
      };

      return {
        req,
        supabase,
        loaders: createLoaders(supabase),
        session,
      };
    } catch (error) {
      console.error('Failed to decode Authorization token:', error);
      // Fall through to cookie-based auth
    }
  }

  // Fallback: try cookie-based auth (for same-domain requests)
  const supabase = createServerClient({
    cookies: {
      getAll: () => {
        return req.cookies.getAll();
      },
      setAll: () => {
        // Response cookies are handled by the route handler
        // We can't set cookies here since we don't have access to the response yet
      },
    },
  });

  // Get session and extract claims
  const sessionData = await getSession({ client: supabase });

  const session = sessionData
    ? {
        claims: sessionData.claims,
        userId: sessionData.user.id,
        email: sessionData.user.email ?? '',
      }
    : null;

  return {
    req,
    supabase,
    loaders: createLoaders(supabase),
    session,
  };
}

/**
 * Helper to require authentication in resolvers
 * Throws GraphQL error if not authenticated
 */
export function requireAuth(ctx: GraphQLContext): NonNullable<GraphQLContext['session']> {
  if (!ctx.session) {
    throw new Error('Authentication required');
  }
  return ctx.session;
}

/**
 * Helper to require a specific role or higher
 * Role hierarchy: reader < scholar < translator < editor < admin
 */
const ROLE_HIERARCHY: UserRole[] = ['reader', 'scholar', 'translator', 'editor', 'admin'];

export function requireRole(ctx: GraphQLContext, requiredRole: UserRole): NonNullable<GraphQLContext['session']> {
  const session = requireAuth(ctx);
  const userRoleIndex = ROLE_HIERARCHY.indexOf(session.claims.role);
  const requiredRoleIndex = ROLE_HIERARCHY.indexOf(requiredRole);

  if (userRoleIndex < requiredRoleIndex) {
    throw new Error(`Insufficient permissions. Required role: ${requiredRole}`);
  }

  return session;
}
