import type { GraphQLClient } from 'graphql-request';
import { gql } from 'graphql-request';

// Permission enum matching the GraphQL schema
export type Permission =
  | 'PROJECTS_READ'
  | 'PROJECTS_EDIT'
  | 'PROJECTS_ADMIN'
  | 'EDITOR_READ'
  | 'EDITOR_EDIT'
  | 'EDITOR_ADMIN';

const HAS_PERMISSION_QUERY = gql`
  query HasPermission($permission: Permission!) {
    hasPermission(permission: $permission)
  }
`;

interface HasPermissionResponse {
  hasPermission: boolean;
}

/**
 * Check if the current user has a specific permission
 */
export const hasPermission = async ({
  client,
  permission,
}: {
  client: GraphQLClient;
  permission: Permission;
}): Promise<boolean> => {
  const response = await client.request<HasPermissionResponse>(
    HAS_PERMISSION_QUERY,
    { permission },
  );
  return response.hasPermission;
};
