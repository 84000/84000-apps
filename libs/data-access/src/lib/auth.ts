import { jwtDecode } from 'jwt-decode';
import { DataClient, UserRole } from './types';

export const getUser = async ({ client }: { client: DataClient }) => {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session) {
    console.info(`Failed to get session data: ${error}`);
    return null;
  }

  const { user, access_token } = data.session;
  const { user_role: role = 'reader' } = jwtDecode(access_token) as {
    user_role: UserRole;
  };
  const { id, email, user_metadata: metadata } = user;
  const { name, picture } = metadata;
  if (id && email) {
    return {
      id,
      email,
      username: email,
      name,
      avatar: picture,
      role,
    };
  }

  return null;
};

export const loginWithGoogle = async ({
  client,
  redirectTo = undefined,
}: {
  client: DataClient;
  redirectTo: string | undefined;
}) => {
  await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
        hd: '84000.co',
      },
    },
  });
};

export const logout = async ({ client }: { client: DataClient }) => {
  await client.auth.signOut();
};
