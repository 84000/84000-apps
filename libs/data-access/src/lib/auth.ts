import { DataClient } from './types';

export const getUser = async ({ client }: { client: DataClient }) => {
  const { data, error } = await client.auth.getUser();
  if (error) {
    console.info(`Failed to get user data: ${error}`);
    return null;
  }

  const { id, email, user_metadata: metadata } = data.user;
  const { name, picture } = metadata;
  if (id && email) {
    return {
      id,
      email,
      username: email,
      name,
      avatar: picture,
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
