import { jwtDecode } from 'jwt-decode';
import { DataClient, UserClaims, UserRole } from './types';

export const getSession = async ({ client }: { client: DataClient }) => {
  const { data, error } = await client.auth.getSession();
  if (error || !data?.session) {
    console.info(`Failed to get session data: ${error}`);
    return null;
  }

  const { access_token } = data.session;
  if (!access_token) {
    return null;
  }

  try {
    const decoded = jwtDecode(access_token);
    const { user_role: role = 'reader' } = decoded as {
      user_role: UserRole;
    };
    const claims: UserClaims = {
      role,
    };

    return { claims, ...data.session };
  } catch (error) {
    console.error('Failed to decode JWT:', error);
    return null;
  }
};

export const getUser = async ({ client }: { client: DataClient }) => {
  const session = await getSession({ client });
  if (!session) {
    return null;
  }

  const { claims, user } = session;
  const { role } = claims;

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

export const loginWithApple = async ({
  client,
  redirectTo = undefined,
}: {
  client: DataClient;
  redirectTo: string | undefined;
}) => {
  await client.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo,
      queryParams: {
        scope: 'email name',
      },
    },
  });
};

export const loginWithEmail = async ({
  client,
  email,
  password,
}: {
  client: DataClient;
  email: string;
  password: string;
}) => {
  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.error(`Failed to login with email: ${error.message}`);
    throw error;
  }
};

export const logout = async ({ client }: { client: DataClient }) => {
  await client.auth.signOut();
};

export const resetPassword = async ({
  client,
  email,
  redirectTo = undefined,
}: {
  client: DataClient;
  email: string;
  redirectTo?: string;
}) => {
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    console.error(`Failed to reset password: ${error.message}`);
    throw error;
  }
};

export const signUpWithEmail = async ({
  client,
  email,
  password,
  redirectTo = undefined,
}: {
  client: DataClient;
  email: string;
  password: string;
  redirectTo?: string;
}) => {
  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectTo,
    },
  });

  if (error) {
    console.error(`Failed to sign up with email: ${error.message}`);
    throw error;
  }
};
